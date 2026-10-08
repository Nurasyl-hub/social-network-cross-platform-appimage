package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"social-network/pkg/middleware"
	ws "social-network/pkg/websocket"

	"github.com/gofrs/uuid"
	"github.com/gorilla/mux"
)

type GroupHandler struct {
	DB	*sql.DB
	Hub	*ws.Hub
}

func (h *GroupHandler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetUserFromContext(r)
	var body struct {
		Title		string	`json:"title"`
		Description	string	`json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		JSONError(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if body.Title == "" || body.Description == "" {
		JSONError(w, "Title and description required", http.StatusBadRequest)
		return
	}

	id, _ := uuid.NewV4()
	now := time.Now()
	h.DB.Exec(
		`INSERT INTO groups (id, creator_id, title, description, created_at) VALUES (?, ?, ?, ?, ?)`,
		id.String(), currentUser.ID, body.Title, body.Description, now,
	)

	h.DB.Exec(
		`INSERT INTO group_members (group_id, user_id, status, invited_by) VALUES (?, ?, 'accepted', ?)`,
		id.String(), currentUser.ID, currentUser.ID,
	)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":	id.String(), "creator_id": currentUser.ID,
		"title":	body.Title, "description": body.Description, "created_at": now,
	})
}

func (h *GroupHandler) ListGroups(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetUserFromContext(r)
	rows, err := h.DB.Query(
		`SELECT g.id, g.creator_id, g.title, g.description, g.created_at,
		        u.first_name, u.last_name,
		        (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.id AND gm.status = 'accepted') AS member_count,
		        EXISTS(SELECT 1 FROM group_members gm2 WHERE gm2.group_id = g.id AND gm2.user_id = ? AND gm2.status = 'accepted') AS is_member
		 FROM groups g JOIN users u ON u.id = g.creator_id ORDER BY g.created_at DESC`,
		currentUser.ID,
	)
	if err != nil {
		JSONError(w, "Failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var groups []map[string]interface{}
	for rows.Next() {
		var id, creatorID, title, desc string
		var fn, ln string
		var memberCount int
		var isMember bool
		var createdAt time.Time
		rows.Scan(&id, &creatorID, &title, &desc, &createdAt, &fn, &ln, &memberCount, &isMember)
		groups = append(groups, map[string]interface{}{
			"id":	id, "creator_id": creatorID, "title": title, "description": desc,
			"created_at":	createdAt, "member_count": memberCount, "is_member": isMember,
			"creator_name":	fn + " " + ln,
		})
	}
	if groups == nil {
		groups = []map[string]interface{}{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groups)
}

func (h *GroupHandler) GetGroup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	var id, creatorID, title, desc string
	var createdAt time.Time
	var fn, ln string
	err := h.DB.QueryRow(
		`SELECT g.id, g.creator_id, g.title, g.description, g.created_at, u.first_name, u.last_name
		 FROM groups g JOIN users u ON u.id = g.creator_id WHERE g.id = ?`, groupID,
	).Scan(&id, &creatorID, &title, &desc, &createdAt, &fn, &ln)
	if err != nil {
		JSONError(w, "Group not found", http.StatusNotFound)
		return
	}

	var isMember bool
	var memberStatus string
	h.DB.QueryRow(
		`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`,
		groupID, currentUser.ID,
	).Scan(&memberStatus)
	isMember = memberStatus == "accepted"

	mRows, _ := h.DB.Query(
		`SELECT u.id, u.first_name, u.last_name, u.avatar FROM users u
		 JOIN group_members gm ON gm.user_id = u.id
		 WHERE gm.group_id = ? AND gm.status = 'accepted'`, groupID,
	)
	var members []map[string]string
	if mRows != nil {
		defer mRows.Close()
		for mRows.Next() {
			var uid, f, l, av string
			mRows.Scan(&uid, &f, &l, &av)
			members = append(members, map[string]string{"id": uid, "first_name": f, "last_name": l, "avatar": av})
		}
	}
	if members == nil {
		members = []map[string]string{}
	}

	result := map[string]interface{}{
		"id":	id, "creator_id": creatorID, "title": title, "description": desc,
		"created_at":	createdAt, "creator_name": fn + " " + ln,
		"is_member":	isMember, "member_status": memberStatus, "members": members,
		"is_creator":	creatorID == currentUser.ID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *GroupHandler) DeleteGroup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	var creatorID string
	err := h.DB.QueryRow(`SELECT creator_id FROM groups WHERE id = ?`, groupID).Scan(&creatorID)
	if err != nil {
		JSONError(w, "Group not found", http.StatusNotFound)
		return
	}
	if creatorID != currentUser.ID {
		JSONError(w, "Forbidden", http.StatusForbidden)
		return
	}

	h.DB.Exec(`DELETE FROM groups WHERE id = ?`, groupID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Group deleted"})
}

func (h *GroupHandler) RequestJoin(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	var existing string
	err := h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, currentUser.ID).Scan(&existing)
	if err == nil {
		JSONError(w, "Already a member or already processed", http.StatusConflict)
		return
	}

	_, err = h.DB.Exec(
		`INSERT INTO group_members (group_id, user_id, status) VALUES (?, ?, 'accepted')`,
		groupID, currentUser.ID,
	)
	if err != nil {
		JSONError(w, "Failed to join group", http.StatusInternalServerError)
		return
	}

	var creatorID, groupTitle string
	h.DB.QueryRow(`SELECT creator_id, title FROM groups WHERE id = ?`, groupID).Scan(&creatorID, &groupTitle)
	notifID, _ := uuid.NewV4()
	h.DB.Exec(
		`INSERT INTO notifications (id, user_id, from_user_id, type, content, reference_id) VALUES (?, ?, ?, ?, ?, ?)`,
		notifID.String(), creatorID, currentUser.ID, "group_join",
		currentUser.FirstName+" "+currentUser.LastName+" joined "+groupTitle,
		groupID,
	)
	h.Hub.SendNotification(creatorID, ws.NotificationPayload{
		ID:		notifID.String(),
		Type:		"group_join",
		Content:	currentUser.FirstName + " " + currentUser.LastName + " joined " + groupTitle,
		ReferenceID:	groupID,
		FromUserID:	currentUser.ID,
		FromName:	currentUser.FirstName + " " + currentUser.LastName,
		CreatedAt:	time.Now().Format(time.RFC3339),
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Joined successfully"})
}

func (h *GroupHandler) InviteUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	var body struct {
		UserID string `json:"user_id"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	var status string
	h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, currentUser.ID).Scan(&status)
	if status != "accepted" {
		JSONError(w, "Must be a member to invite", http.StatusForbidden)
		return
	}

	var existing string
	err := h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, body.UserID).Scan(&existing)
	if err == nil {
		JSONError(w, "User already in group or already invited", http.StatusConflict)
		return
	}

	h.DB.Exec(
		`INSERT INTO group_members (group_id, user_id, status, invited_by) VALUES (?, ?, 'accepted', ?)`,
		groupID, body.UserID, currentUser.ID,
	)

	var groupTitle string
	h.DB.QueryRow(`SELECT title FROM groups WHERE id = ?`, groupID).Scan(&groupTitle)

	notifID, _ := uuid.NewV4()
	h.DB.Exec(
		`INSERT INTO notifications (id, user_id, from_user_id, type, content, reference_id) VALUES (?, ?, ?, ?, ?, ?)`,
		notifID.String(), body.UserID, currentUser.ID, "group_invitation",
		currentUser.FirstName+" "+currentUser.LastName+" added you to "+groupTitle,
		groupID,
	)
	h.Hub.SendNotification(body.UserID, ws.NotificationPayload{
		ID:		notifID.String(),
		Type:		"group_invitation",
		Content:	currentUser.FirstName + " " + currentUser.LastName + " added you to " + groupTitle,
		ReferenceID:	groupID,
		FromUserID:	currentUser.ID,
		FromName:	currentUser.FirstName + " " + currentUser.LastName,
		CreatedAt:	time.Now().Format(time.RFC3339),
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User added to group"})
}

func (h *GroupHandler) CreateGroupPost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	var status string
	h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, currentUser.ID).Scan(&status)
	if status != "accepted" {
		JSONError(w, "Must be a member", http.StatusForbidden)
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		r.ParseForm()
	}
	content := r.FormValue("content")
	if content == "" {
		JSONError(w, "Content required", http.StatusBadRequest)
		return
	}

	image := ""
	file, fh, err := r.FormFile("image")
	if err == nil {
		defer file.Close()
		if imgPath, err := SaveUploadedFile(file, fh); err == nil {
			image = imgPath
		}
	}

	id, _ := uuid.NewV4()
	now := time.Now()
	h.DB.Exec(
		`INSERT INTO group_posts (id, group_id, user_id, content, image, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		id.String(), groupID, currentUser.ID, content, image, now,
	)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":	id.String(), "group_id": groupID, "user_id": currentUser.ID,
		"content":	content, "image": image, "created_at": now,
		"likes_count":	0, "dislikes_count": 0, "user_reaction": "",
	})
}

func (h *GroupHandler) DeleteGroupPost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	postID := vars["post_id"]
	currentUser := middleware.GetUserFromContext(r)

	var status string
	h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, currentUser.ID).Scan(&status)
	if status != "accepted" {
		JSONError(w, "Must be a member", http.StatusForbidden)
		return
	}

	var ownerID, creatorID string
	err := h.DB.QueryRow(`SELECT user_id FROM group_posts WHERE id = ?`, postID).Scan(&ownerID)
	if err != nil {
		JSONError(w, "Post not found", http.StatusNotFound)
		return
	}
	h.DB.QueryRow(`SELECT creator_id FROM groups WHERE id = ?`, groupID).Scan(&creatorID)
	if ownerID != currentUser.ID && creatorID != currentUser.ID {
		JSONError(w, "Forbidden", http.StatusForbidden)
		return
	}

	h.DB.Exec(`DELETE FROM group_posts WHERE id = ?`, postID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Group post deleted"})
}

func (h *GroupHandler) ReactGroupPost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	postID := vars["post_id"]
	currentUser := middleware.GetUserFromContext(r)

	var status string
	h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, currentUser.ID).Scan(&status)
	if status != "accepted" {
		JSONError(w, "Must be a member", http.StatusForbidden)
		return
	}

	var body struct {
		Reaction string `json:"reaction"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.Reaction != "like" && body.Reaction != "dislike" {
		JSONError(w, "Invalid reaction", http.StatusBadRequest)
		return
	}

	var existing string
	err := h.DB.QueryRow(`SELECT reaction FROM group_post_likes WHERE post_id = ? AND user_id = ?`, postID, currentUser.ID).Scan(&existing)
	if err == nil {
		if existing == body.Reaction {
			h.DB.Exec(`DELETE FROM group_post_likes WHERE post_id = ? AND user_id = ?`, postID, currentUser.ID)
		} else {
			h.DB.Exec(`UPDATE group_post_likes SET reaction = ? WHERE post_id = ? AND user_id = ?`, body.Reaction, postID, currentUser.ID)
		}
	} else {
		h.DB.Exec(`INSERT INTO group_post_likes (post_id, user_id, reaction) VALUES (?, ?, ?)`, postID, currentUser.ID, body.Reaction)
	}

	var likesCount, dislikesCount int
	h.DB.QueryRow(`SELECT COUNT(*) FROM group_post_likes WHERE post_id = ? AND reaction = 'like'`, postID).Scan(&likesCount)
	h.DB.QueryRow(`SELECT COUNT(*) FROM group_post_likes WHERE post_id = ? AND reaction = 'dislike'`, postID).Scan(&dislikesCount)
	var userReaction string
	h.DB.QueryRow(`SELECT reaction FROM group_post_likes WHERE post_id = ? AND user_id = ?`, postID, currentUser.ID).Scan(&userReaction)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"likes_count":		likesCount,
		"dislikes_count":	dislikesCount,
		"user_reaction":	userReaction,
	})
}

func (h *GroupHandler) GetGroupPosts(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	var status string
	h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, currentUser.ID).Scan(&status)
	if status != "accepted" {
		JSONError(w, "Must be a member", http.StatusForbidden)
		return
	}

	rows, err := h.DB.Query(
		`SELECT gp.id, gp.group_id, gp.user_id, gp.content, gp.image, gp.created_at,
		        u.first_name, u.last_name, u.avatar,
		        (SELECT COUNT(*) FROM group_post_likes WHERE post_id = gp.id AND reaction = 'like') AS likes_count,
		        (SELECT COUNT(*) FROM group_post_likes WHERE post_id = gp.id AND reaction = 'dislike') AS dislikes_count,
		        COALESCE((SELECT reaction FROM group_post_likes WHERE post_id = gp.id AND user_id = ?), '') AS user_reaction
		 FROM group_posts gp JOIN users u ON u.id = gp.user_id
		 WHERE gp.group_id = ? ORDER BY gp.created_at DESC`, currentUser.ID, groupID,
	)
	if err != nil {
		JSONError(w, "Failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var posts []map[string]interface{}
	for rows.Next() {
		var id, gid, uid, content, image string
		var fn, ln, av, userReaction string
		var createdAt time.Time
		var likesCount, dislikesCount int
		rows.Scan(&id, &gid, &uid, &content, &image, &createdAt, &fn, &ln, &av, &likesCount, &dislikesCount, &userReaction)

		var commentCount int
		h.DB.QueryRow(`SELECT COUNT(*) FROM group_comments WHERE post_id = ?`, id).Scan(&commentCount)

		posts = append(posts, map[string]interface{}{
			"id":	id, "group_id": gid, "user_id": uid, "content": content,
			"image":	image, "created_at": createdAt, "comment_count": commentCount,
			"likes_count":	likesCount, "dislikes_count": dislikesCount, "user_reaction": userReaction,
			"author":	map[string]string{"id": uid, "first_name": fn, "last_name": ln, "avatar": av},
		})
	}
	if posts == nil {
		posts = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

func (h *GroupHandler) CreateGroupComment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	postID := vars["post_id"]
	currentUser := middleware.GetUserFromContext(r)

	var status string
	h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, currentUser.ID).Scan(&status)
	if status != "accepted" {
		JSONError(w, "Must be a member", http.StatusForbidden)
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		r.ParseForm()
	}
	content := r.FormValue("content")
	if content == "" {
		JSONError(w, "Content required", http.StatusBadRequest)
		return
	}

	image := ""
	file, fh, err := r.FormFile("image")
	if err == nil {
		defer file.Close()
		if imgPath, err := SaveUploadedFile(file, fh); err == nil {
			image = imgPath
		}
	}

	id, _ := uuid.NewV4()
	now := time.Now()
	h.DB.Exec(
		`INSERT INTO group_comments (id, post_id, user_id, content, image, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		id.String(), postID, currentUser.ID, content, image, now,
	)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":	id.String(), "post_id": postID, "user_id": currentUser.ID,
		"content":	content, "image": image, "created_at": now,
		"author": map[string]string{
			"id":	currentUser.ID, "first_name": currentUser.FirstName,
			"last_name":	currentUser.LastName, "avatar": currentUser.Avatar,
		},
	})
}

func (h *GroupHandler) DeleteGroupComment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	commentID := vars["comment_id"]
	currentUser := middleware.GetUserFromContext(r)

	var status string
	h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, currentUser.ID).Scan(&status)
	if status != "accepted" {
		JSONError(w, "Must be a member", http.StatusForbidden)
		return
	}

	var ownerID, creatorID string
	err := h.DB.QueryRow(`SELECT user_id FROM group_comments WHERE id = ?`, commentID).Scan(&ownerID)
	if err != nil {
		JSONError(w, "Comment not found", http.StatusNotFound)
		return
	}
	h.DB.QueryRow(`SELECT creator_id FROM groups WHERE id = ?`, groupID).Scan(&creatorID)
	if ownerID != currentUser.ID && creatorID != currentUser.ID {
		JSONError(w, "Forbidden", http.StatusForbidden)
		return
	}

	h.DB.Exec(`DELETE FROM group_comments WHERE id = ?`, commentID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Comment deleted"})
}

func (h *GroupHandler) GetGroupComments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	postID := vars["post_id"]
	currentUser := middleware.GetUserFromContext(r)

	var status string
	h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, currentUser.ID).Scan(&status)
	if status != "accepted" {
		JSONError(w, "Must be a member", http.StatusForbidden)
		return
	}

	rows, _ := h.DB.Query(
		`SELECT gc.id, gc.post_id, gc.user_id, gc.content, gc.image, gc.created_at,
		        u.first_name, u.last_name, u.avatar
		 FROM group_comments gc JOIN users u ON u.id = gc.user_id
		 WHERE gc.post_id = ? ORDER BY gc.created_at ASC`, postID,
	)
	var comments []map[string]interface{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var id, pid, uid, content, image string
			var fn, ln, av string
			var createdAt time.Time
			rows.Scan(&id, &pid, &uid, &content, &image, &createdAt, &fn, &ln, &av)
			comments = append(comments, map[string]interface{}{
				"id":	id, "post_id": pid, "user_id": uid, "content": content,
				"image":	image, "created_at": createdAt,
				"author":	map[string]string{"id": uid, "first_name": fn, "last_name": ln, "avatar": av},
			})
		}
	}
	if comments == nil {
		comments = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comments)
}

func (h *GroupHandler) CreateEvent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	var status string
	h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, currentUser.ID).Scan(&status)
	if status != "accepted" {
		JSONError(w, "Must be a member", http.StatusForbidden)
		return
	}

	var body struct {
		Title		string	`json:"title"`
		Description	string	`json:"description"`
		EventTime	string	`json:"event_time"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	if body.Title == "" || body.EventTime == "" {
		JSONError(w, "Title and event time required", http.StatusBadRequest)
		return
	}

	eventTime, err := time.Parse(time.RFC3339, body.EventTime)
	if err != nil {
		eventTime, err = time.Parse("2006-01-02T15:04", body.EventTime)
		if err != nil {
			JSONError(w, "Invalid event_time format", http.StatusBadRequest)
			return
		}
	}

	id, _ := uuid.NewV4()
	now := time.Now()
	h.DB.Exec(
		`INSERT INTO group_events (id, group_id, creator_id, title, description, event_time, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id.String(), groupID, currentUser.ID, body.Title, body.Description, eventTime, now,
	)

	memberRows, _ := h.DB.Query(
		`SELECT user_id FROM group_members WHERE group_id = ? AND status = 'accepted' AND user_id != ?`,
		groupID, currentUser.ID,
	)
	var groupTitle string
	h.DB.QueryRow(`SELECT title FROM groups WHERE id = ?`, groupID).Scan(&groupTitle)

	if memberRows != nil {
		defer memberRows.Close()
		for memberRows.Next() {
			var memberID string
			memberRows.Scan(&memberID)
			notifID, _ := uuid.NewV4()
			h.DB.Exec(
				`INSERT INTO notifications (id, user_id, from_user_id, type, content, reference_id) VALUES (?, ?, ?, ?, ?, ?)`,
				notifID.String(), memberID, currentUser.ID, "group_event",
				"New event in "+groupTitle+": "+body.Title,
				id.String(),
			)
			h.Hub.SendNotification(memberID, ws.NotificationPayload{
				ID:		notifID.String(),
				Type:		"group_event",
				Content:	"New event in " + groupTitle + ": " + body.Title,
				ReferenceID:	id.String(),
				FromUserID:	currentUser.ID,
				FromName:	currentUser.FirstName + " " + currentUser.LastName,
				CreatedAt:	now.Format(time.RFC3339),
			})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":	id.String(), "group_id": groupID, "title": body.Title,
		"description":	body.Description, "event_time": eventTime, "created_at": now,
	})
}

func (h *GroupHandler) GetEvents(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	var status string
	h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, currentUser.ID).Scan(&status)
	if status != "accepted" {
		JSONError(w, "Must be a member", http.StatusForbidden)
		return
	}

	rows, _ := h.DB.Query(
		`SELECT ge.id, ge.group_id, ge.creator_id, ge.title, ge.description, ge.event_time, ge.created_at,
		        u.first_name, u.last_name
		 FROM group_events ge JOIN users u ON u.id = ge.creator_id
		 WHERE ge.group_id = ? ORDER BY ge.event_time ASC`, groupID,
	)
	var events []map[string]interface{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var id, gid, cid, title, desc string
			var fn, ln string
			var eventTime, createdAt time.Time
			rows.Scan(&id, &gid, &cid, &title, &desc, &eventTime, &createdAt, &fn, &ln)

			var goingCount, notGoingCount int
			h.DB.QueryRow(`SELECT COUNT(*) FROM event_responses WHERE event_id = ? AND response = 'going'`, id).Scan(&goingCount)
			h.DB.QueryRow(`SELECT COUNT(*) FROM event_responses WHERE event_id = ? AND response = 'not_going'`, id).Scan(&notGoingCount)

			var userResponse string
			h.DB.QueryRow(`SELECT response FROM event_responses WHERE event_id = ? AND user_id = ?`, id, currentUser.ID).Scan(&userResponse)

			events = append(events, map[string]interface{}{
				"id":	id, "group_id": gid, "creator_id": cid, "title": title,
				"description":	desc, "event_time": eventTime, "created_at": createdAt,
				"creator_name":	fn + " " + ln, "going_count": goingCount,
				"not_going_count":	notGoingCount, "user_response": userResponse,
			})
		}
	}
	if events == nil {
		events = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

func (h *GroupHandler) RespondToEvent(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	eventID := vars["event_id"]
	currentUser := middleware.GetUserFromContext(r)

	var status string
	h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, currentUser.ID).Scan(&status)
	if status != "accepted" {
		JSONError(w, "Must be a member", http.StatusForbidden)
		return
	}

	var body struct {
		Response string `json:"response"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.Response != "going" && body.Response != "not_going" {
		JSONError(w, "Invalid response", http.StatusBadRequest)
		return
	}

	h.DB.Exec(
		`INSERT OR REPLACE INTO event_responses (event_id, user_id, response) VALUES (?, ?, ?)`,
		eventID, currentUser.ID, body.Response,
	)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"response": body.Response})
}

func (h *GroupHandler) GetGroupMessages(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	var status string
	h.DB.QueryRow(`SELECT status FROM group_members WHERE group_id = ? AND user_id = ?`, groupID, currentUser.ID).Scan(&status)
	if status != "accepted" {
		JSONError(w, "Must be a member", http.StatusForbidden)
		return
	}

	rows, _ := h.DB.Query(
		`SELECT gm.id, gm.group_id, gm.sender_id, gm.content, gm.created_at,
		        u.first_name, u.last_name, u.avatar
		 FROM group_messages gm JOIN users u ON u.id = gm.sender_id
		 WHERE gm.group_id = ? ORDER BY gm.created_at ASC LIMIT 100`, groupID,
	)
	var messages []map[string]interface{}
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var id, gid, sid, content string
			var fn, ln, av string
			var createdAt time.Time
			rows.Scan(&id, &gid, &sid, &content, &createdAt, &fn, &ln, &av)
			messages = append(messages, map[string]interface{}{
				"id":	id, "group_id": gid, "sender_id": sid, "content": content,
				"created_at":	createdAt,
				"sender":	map[string]string{"id": sid, "first_name": fn, "last_name": ln, "avatar": av},
			})
		}
	}
	if messages == nil {
		messages = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}
