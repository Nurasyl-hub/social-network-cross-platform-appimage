package websocket

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gofrs/uuid"
	"github.com/gorilla/websocket"
	"social-network/pkg/middleware"
)

var upgrader = websocket.Upgrader{
	CheckOrigin:		func(r *http.Request) bool { return true },
	ReadBufferSize:		1024,
	WriteBufferSize:	1024,
}

type Client struct {
	UserID	string
	Conn	*websocket.Conn
	Send	chan []byte
	Hub	*Hub
}

type Hub struct {
	clients	map[string]*Client
	mu	sync.RWMutex
	db	*sql.DB
}

type WSMessage struct {
	Type	string		`json:"type"`
	Payload	interface{}	`json:"payload"`
}

type ChatMessage struct {
	ID		string	`json:"id"`
	SenderID	string	`json:"sender_id"`
	RecipientID	string	`json:"recipient_id,omitempty"`
	GroupID		string	`json:"group_id,omitempty"`
	Content		string	`json:"content"`
	SenderName	string	`json:"sender_name"`
	SenderAvatar	string	`json:"sender_avatar"`
	CreatedAt	string	`json:"created_at"`
}

type NotificationPayload struct {
	ID		string	`json:"id"`
	Type		string	`json:"type"`
	Content		string	`json:"content"`
	ReferenceID	string	`json:"reference_id"`
	FromUserID	string	`json:"from_user_id"`
	FromName	string	`json:"from_name"`
	CreatedAt	string	`json:"created_at"`
}

func NewHub(db *sql.DB) *Hub {
	return &Hub{
		clients:	make(map[string]*Client),
		db:		db,
	}
}

func (h *Hub) Register(userID string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if existing, ok := h.clients[userID]; ok {
		close(existing.Send)
	}
	h.clients[userID] = client
}

func (h *Hub) Unregister(userID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if client, ok := h.clients[userID]; ok {
		close(client.Send)
		delete(h.clients, userID)
	}
}

func (h *Hub) SendToUser(userID string, msg WSMessage) {
	h.mu.RLock()
	client, ok := h.clients[userID]
	h.mu.RUnlock()
	if !ok {
		return
	}
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case client.Send <- data:
	default:
	}
}

func (h *Hub) SendNotification(userID string, notif NotificationPayload) {
	h.SendToUser(userID, WSMessage{Type: "notification", Payload: notif})
}

func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r)
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	client := &Client{
		UserID:	user.ID,
		Conn:	conn,
		Send:	make(chan []byte, 256),
		Hub:	h,
	}

	h.Register(user.ID, client)

	go client.writePump()
	go client.readPump(h)
}

func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) readPump(h *Hub) {
	defer func() {
		h.Unregister(c.UserID)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512 * 1024)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, rawMsg, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}

		var incoming WSMessage
		if err := json.Unmarshal(rawMsg, &incoming); err != nil {
			continue
		}

		switch incoming.Type {
		case "private_message":
			h.handlePrivateMessage(c.UserID, incoming.Payload)
		case "group_message":
			h.handleGroupMessage(c.UserID, incoming.Payload)
		}
	}
}

func (h *Hub) handlePrivateMessage(senderID string, payload interface{}) {
	data, _ := json.Marshal(payload)
	var msg ChatMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return
	}

	var canMessage bool
	var isPublic bool
	h.db.QueryRow(`SELECT is_public FROM users WHERE id = ?`, msg.RecipientID).Scan(&isPublic)
	if isPublic {
		canMessage = true
	} else {
		var count int
		h.db.QueryRow(
			`SELECT COUNT(*) FROM followers WHERE 
			((follower_id = ? AND following_id = ?) OR (follower_id = ? AND following_id = ?))
			AND status = 'accepted'`,
			senderID, msg.RecipientID, msg.RecipientID, senderID,
		).Scan(&count)
		canMessage = count > 0
	}

	if !canMessage {
		return
	}

	id, _ := uuid.NewV4()
	now := time.Now()
	h.db.Exec(
		`INSERT INTO messages (id, sender_id, recipient_id, content, created_at) VALUES (?, ?, ?, ?, ?)`,
		id.String(), senderID, msg.RecipientID, msg.Content, now,
	)

	var firstName, lastName, avatar string
	h.db.QueryRow(`SELECT first_name, last_name, avatar FROM users WHERE id = ?`, senderID).
		Scan(&firstName, &lastName, &avatar)

	outMsg := ChatMessage{
		ID:		id.String(),
		SenderID:	senderID,
		RecipientID:	msg.RecipientID,
		Content:	msg.Content,
		SenderName:	firstName + " " + lastName,
		SenderAvatar:	avatar,
		CreatedAt:	now.Format(time.RFC3339),
	}

	wsMsg := WSMessage{Type: "private_message", Payload: outMsg}
	h.SendToUser(msg.RecipientID, wsMsg)
	h.SendToUser(senderID, wsMsg)
}

func (h *Hub) handleGroupMessage(senderID string, payload interface{}) {
	data, _ := json.Marshal(payload)
	var msg ChatMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		return
	}

	var count int
	h.db.QueryRow(
		`SELECT COUNT(*) FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'accepted'`,
		msg.GroupID, senderID,
	).Scan(&count)
	if count == 0 {
		return
	}

	id, _ := uuid.NewV4()
	now := time.Now()
	h.db.Exec(
		`INSERT INTO group_messages (id, group_id, sender_id, content, created_at) VALUES (?, ?, ?, ?, ?)`,
		id.String(), msg.GroupID, senderID, msg.Content, now,
	)

	var firstName, lastName, avatar string
	h.db.QueryRow(`SELECT first_name, last_name, avatar FROM users WHERE id = ?`, senderID).
		Scan(&firstName, &lastName, &avatar)

	outMsg := ChatMessage{
		ID:		id.String(),
		GroupID:	msg.GroupID,
		SenderID:	senderID,
		Content:	msg.Content,
		SenderName:	firstName + " " + lastName,
		SenderAvatar:	avatar,
		CreatedAt:	now.Format(time.RFC3339),
	}
	wsMsg := WSMessage{Type: "group_message", Payload: outMsg}

	rows, err := h.db.Query(
		`SELECT user_id FROM group_members WHERE group_id = ? AND status = 'accepted'`,
		msg.GroupID,
	)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var uid string
		rows.Scan(&uid)
		h.SendToUser(uid, wsMsg)
	}
}
