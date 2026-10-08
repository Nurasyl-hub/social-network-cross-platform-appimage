package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"social-network/pkg/middleware"
)

type NotificationHandler struct {
	DB *sql.DB
}

func (h *NotificationHandler) GetNotifications(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetUserFromContext(r)

	rows, err := h.DB.Query(
		`SELECT n.id, n.user_id, n.from_user_id, n.type, n.content, n.reference_id, n.is_read, n.created_at,
		        u.first_name, u.last_name, u.avatar
		 FROM notifications n
		 LEFT JOIN users u ON u.id = n.from_user_id
		 WHERE n.user_id = ?
		 ORDER BY n.created_at DESC LIMIT 50`,
		currentUser.ID,
	)
	if err != nil {
		JSONError(w, "Failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var notifications []map[string]interface{}
	for rows.Next() {
		var id, userID, fromUserID, ntype, content, referenceID string
		var fn, ln, av string
		var isRead bool
		var createdAt time.Time
		rows.Scan(&id, &userID, &fromUserID, &ntype, &content, &referenceID, &isRead, &createdAt, &fn, &ln, &av)

		notif := map[string]interface{}{
			"id":	id, "user_id": userID, "from_user_id": fromUserID,
			"type":	ntype, "content": content, "reference_id": referenceID,
			"is_read":	isRead, "created_at": createdAt,
		}
		if fromUserID != "" {
			notif["from_user"] = map[string]string{
				"id":	fromUserID, "first_name": fn, "last_name": ln, "avatar": av,
			}
		}
		notifications = append(notifications, notif)
	}
	if notifications == nil {
		notifications = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(notifications)
}

func (h *NotificationHandler) MarkRead(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	notifID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	h.DB.Exec(
		`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
		notifID, currentUser.ID,
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Marked as read"})
}

func (h *NotificationHandler) MarkAllRead(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetUserFromContext(r)
	h.DB.Exec(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, currentUser.ID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "All marked as read"})
}

func (h *NotificationHandler) GetUnreadCount(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetUserFromContext(r)
	var count int
	h.DB.QueryRow(`SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0`, currentUser.ID).Scan(&count)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]int{"count": count})
}
