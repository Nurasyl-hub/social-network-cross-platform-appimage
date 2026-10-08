package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gofrs/uuid"
	"github.com/gorilla/mux"
	"social-network/pkg/middleware"
	ws "social-network/pkg/websocket"
)

type FollowerHandler struct {
	DB	*sql.DB
	Hub	*ws.Hub
}

func (h *FollowerHandler) SendFollowRequest(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	targetID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	if currentUser.ID == targetID {
		JSONError(w, "Cannot follow yourself", http.StatusBadRequest)
		return
	}

	var existing string
	err := h.DB.QueryRow(
		`SELECT status FROM followers WHERE follower_id = ? AND following_id = ?`,
		currentUser.ID, targetID,
	).Scan(&existing)
	if err == nil {
		JSONError(w, "Follow request already exists: "+existing, http.StatusConflict)
		return
	}

	var isPublic bool
	h.DB.QueryRow(`SELECT is_public FROM users WHERE id = ?`, targetID).Scan(&isPublic)

	status := "pending"
	if isPublic {
		status = "accepted"
	}

	_, err = h.DB.Exec(
		`INSERT INTO followers (follower_id, following_id, status, created_at) VALUES (?, ?, ?, ?)`,
		currentUser.ID, targetID, status, time.Now(),
	)
	if err != nil {
		JSONError(w, "Failed to send follow request", http.StatusInternalServerError)
		return
	}

	if status == "pending" {

		notifID, _ := uuid.NewV4()
		h.DB.Exec(
			`INSERT INTO notifications (id, user_id, from_user_id, type, content, reference_id) VALUES (?, ?, ?, ?, ?, ?)`,
			notifID.String(), targetID, currentUser.ID, "follow_request",
			currentUser.FirstName+" "+currentUser.LastName+" wants to follow you",
			currentUser.ID,
		)
		h.Hub.SendNotification(targetID, ws.NotificationPayload{
			ID:		notifID.String(),
			Type:		"follow_request",
			Content:	currentUser.FirstName + " " + currentUser.LastName + " wants to follow you",
			ReferenceID:	currentUser.ID,
			FromUserID:	currentUser.ID,
			FromName:	currentUser.FirstName + " " + currentUser.LastName,
			CreatedAt:	time.Now().Format(time.RFC3339),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": status})
}

func (h *FollowerHandler) AcceptFollow(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	followerID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	res, err := h.DB.Exec(
		`UPDATE followers SET status = 'accepted' WHERE follower_id = ? AND following_id = ? AND status = 'pending'`,
		followerID, currentUser.ID,
	)
	if err != nil {
		JSONError(w, "Failed to accept", http.StatusInternalServerError)
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		JSONError(w, "No pending request found", http.StatusNotFound)
		return
	}

	h.DB.Exec(
		`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND from_user_id = ? AND type = 'follow_request'`,
		currentUser.ID, followerID,
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Follow accepted"})
}

func (h *FollowerHandler) DeclineFollow(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	followerID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	h.DB.Exec(
		`DELETE FROM followers WHERE follower_id = ? AND following_id = ? AND status = 'pending'`,
		followerID, currentUser.ID,
	)
	h.DB.Exec(
		`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND from_user_id = ? AND type = 'follow_request'`,
		currentUser.ID, followerID,
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Follow declined"})
}

func (h *FollowerHandler) Unfollow(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	targetID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	h.DB.Exec(
		`DELETE FROM followers WHERE follower_id = ? AND following_id = ?`,
		currentUser.ID, targetID,
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Unfollowed"})
}

func (h *FollowerHandler) GetFollowRequests(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetUserFromContext(r)

	rows, err := h.DB.Query(
		`SELECT u.id, u.first_name, u.last_name, u.avatar FROM users u
		 JOIN followers f ON f.follower_id = u.id
		 WHERE f.following_id = ? AND f.status = 'pending'`,
		currentUser.ID,
	)
	if err != nil {
		JSONError(w, "Query failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type Request struct {
		ID		string	`json:"id"`
		FirstName	string	`json:"first_name"`
		LastName	string	`json:"last_name"`
		Avatar		string	`json:"avatar"`
	}
	var requests []Request
	for rows.Next() {
		var req Request
		rows.Scan(&req.ID, &req.FirstName, &req.LastName, &req.Avatar)
		requests = append(requests, req)
	}
	if requests == nil {
		requests = []Request{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}
