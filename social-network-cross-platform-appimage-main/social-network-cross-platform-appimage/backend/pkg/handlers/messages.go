package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"social-network/pkg/middleware"
)

type MessageHandler struct {
	DB *sql.DB
}

func (h *MessageHandler) GetConversations(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetUserFromContext(r)

	rows, err := h.DB.Query(
		`SELECT DISTINCT 
		    CASE WHEN m.sender_id = ? THEN m.recipient_id ELSE m.sender_id END AS other_user_id,
		    m.content, m.created_at, m.sender_id
		 FROM messages m
		 WHERE m.sender_id = ? OR m.recipient_id = ?
		 GROUP BY other_user_id
		 ORDER BY m.created_at DESC`,
		currentUser.ID, currentUser.ID, currentUser.ID,
	)
	if err != nil {
		JSONError(w, "Failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var conversations []map[string]interface{}
	for rows.Next() {
		var otherID, content, senderID string
		var createdAt time.Time
		rows.Scan(&otherID, &content, &createdAt, &senderID)

		var fn, ln, av string
		h.DB.QueryRow(`SELECT first_name, last_name, avatar FROM users WHERE id = ?`, otherID).Scan(&fn, &ln, &av)

		conversations = append(conversations, map[string]interface{}{
			"user": map[string]string{
				"id":	otherID, "first_name": fn, "last_name": ln, "avatar": av,
			},
			"last_message": map[string]interface{}{
				"content":	content, "created_at": createdAt, "sender_id": senderID,
			},
		})
	}
	if conversations == nil {
		conversations = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(conversations)
}

func (h *MessageHandler) GetMessages(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	otherID := vars["user_id"]
	currentUser := middleware.GetUserFromContext(r)

	rows, err := h.DB.Query(
		`SELECT m.id, m.sender_id, m.recipient_id, m.content, m.created_at,
		        u.first_name, u.last_name, u.avatar
		 FROM messages m JOIN users u ON u.id = m.sender_id
		 WHERE (m.sender_id = ? AND m.recipient_id = ?)
		    OR (m.sender_id = ? AND m.recipient_id = ?)
		 ORDER BY m.created_at ASC LIMIT 100`,
		currentUser.ID, otherID, otherID, currentUser.ID,
	)
	if err != nil {
		JSONError(w, "Failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var messages []map[string]interface{}
	for rows.Next() {
		var id, senderID, recipientID, content string
		var fn, ln, av string
		var createdAt time.Time
		rows.Scan(&id, &senderID, &recipientID, &content, &createdAt, &fn, &ln, &av)
		messages = append(messages, map[string]interface{}{
			"id":	id, "sender_id": senderID, "recipient_id": recipientID,
			"content":	content, "created_at": createdAt,
			"sender":	map[string]string{"id": senderID, "first_name": fn, "last_name": ln, "avatar": av},
		})
	}
	if messages == nil {
		messages = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

func (h *MessageHandler) GetChatableUsers(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetUserFromContext(r)

	rows, err := h.DB.Query(
		`SELECT DISTINCT u.id, u.first_name, u.last_name, u.avatar, u.is_public
		 FROM users u
		 WHERE u.id != ? AND (
		     u.is_public = 1
		     OR EXISTS (
		         SELECT 1 FROM followers f
		         WHERE ((f.follower_id = ? AND f.following_id = u.id)
		             OR (f.follower_id = u.id AND f.following_id = ?))
		         AND f.status = 'accepted'
		     )
		 )
		 LIMIT 50`,
		currentUser.ID, currentUser.ID, currentUser.ID,
	)
	if err != nil {
		JSONError(w, "Failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id, fn, ln, av string
		var isPublic bool
		rows.Scan(&id, &fn, &ln, &av, &isPublic)
		users = append(users, map[string]interface{}{
			"id":	id, "first_name": fn, "last_name": ln,
			"avatar":	av, "is_public": isPublic,
		})
	}
	if users == nil {
		users = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
