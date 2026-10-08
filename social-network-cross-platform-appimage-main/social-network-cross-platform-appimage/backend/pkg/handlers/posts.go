package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"social-network/pkg/middleware"
	"social-network/pkg/models"

	"github.com/gofrs/uuid"
	"github.com/gorilla/mux"
)

type PostHandler struct {
	DB *sql.DB
}

func (h *PostHandler) CreatePost(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetUserFromContext(r)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		r.ParseForm()
	}

	content := r.FormValue("content")
	privacy := r.FormValue("privacy")
	viewersRaw := r.FormValue("viewers")

	if content == "" {
		JSONError(w, "Content is required", http.StatusBadRequest)
		return
	}
	if privacy == "" {
		privacy = "public"
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
	_, err = h.DB.Exec(
		`INSERT INTO posts (id, user_id, content, image, privacy, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		id.String(), currentUser.ID, content, image, privacy, time.Now(),
	)
	if err != nil {
		JSONError(w, "Failed to create post", http.StatusInternalServerError)
		return
	}

	if privacy == "private" && viewersRaw != "" {
		viewers := strings.Split(viewersRaw, ",")
		for _, v := range viewers {
			v = strings.TrimSpace(v)
			if v != "" {
				h.DB.Exec(
					`INSERT OR IGNORE INTO post_viewers (post_id, user_id) VALUES (?, ?)`,
					id.String(), v,
				)
			}
		}
	}

	post := models.Post{
		ID:	id.String(), UserID: currentUser.ID, Content: content,
		Image:	image, Privacy: privacy, CreatedAt: time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(post)
}

func (h *PostHandler) GetFeed(w http.ResponseWriter, r *http.Request) {
	currentUser := middleware.GetUserFromContext(r)

	rows, err := h.DB.Query(
		`SELECT DISTINCT p.id, p.user_id, p.content, p.image, p.privacy, p.created_at,
		        u.first_name, u.last_name, u.avatar, u.nickname,
		        (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count,
		        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND reaction = 'like') AS likes_count,
		        (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND reaction = 'dislike') AS dislikes_count,
		        COALESCE((SELECT reaction FROM post_likes WHERE post_id = p.id AND user_id = ?), '') AS user_reaction
		 FROM posts p
		 JOIN users u ON u.id = p.user_id
		 WHERE p.privacy = 'public'
		    OR p.user_id = ?
		    OR (p.privacy = 'almost_private' AND p.user_id IN (
		        SELECT following_id FROM followers WHERE follower_id = ? AND status = 'accepted'
		    ))
		    OR (p.privacy = 'private' AND p.id IN (
		        SELECT post_id FROM post_viewers WHERE user_id = ?
		    ))
		 ORDER BY p.created_at DESC
		 LIMIT 50`,
		currentUser.ID, currentUser.ID, currentUser.ID, currentUser.ID,
	)
	if err != nil {
		JSONError(w, "Failed to fetch feed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var posts []map[string]interface{}
	for rows.Next() {
		var p models.Post
		var firstName, lastName, avatar, nickname string
		var commentCount, likesCount, dislikesCount int
		var userReaction string
		rows.Scan(&p.ID, &p.UserID, &p.Content, &p.Image, &p.Privacy, &p.CreatedAt,
			&firstName, &lastName, &avatar, &nickname,
			&commentCount, &likesCount, &dislikesCount, &userReaction)

		post := map[string]interface{}{
			"id":	p.ID, "user_id": p.UserID, "content": p.Content,
			"image":	p.Image, "privacy": p.Privacy, "created_at": p.CreatedAt,
			"comment_count":	commentCount,
			"likes_count":		likesCount,
			"dislikes_count":	dislikesCount,
			"user_reaction":	userReaction,
			"author": map[string]string{
				"id":	p.UserID, "first_name": firstName, "last_name": lastName,
				"avatar":	avatar, "nickname": nickname,
			},
		}
		posts = append(posts, post)
	}
	if posts == nil {
		posts = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

func (h *PostHandler) GetPost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	postID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	var p models.Post
	var firstName, lastName, avatar, nickname string
	err := h.DB.QueryRow(
		`SELECT p.id, p.user_id, p.content, p.image, p.privacy, p.created_at,
		        u.first_name, u.last_name, u.avatar, u.nickname
		 FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`, postID,
	).Scan(&p.ID, &p.UserID, &p.Content, &p.Image, &p.Privacy, &p.CreatedAt,
		&firstName, &lastName, &avatar, &nickname)
	if err != nil {
		JSONError(w, "Post not found", http.StatusNotFound)
		return
	}

	visible := canViewPost(h.DB, &p, currentUser)
	if !visible {
		JSONError(w, "Forbidden", http.StatusForbidden)
		return
	}

	comments := h.getComments(postID)

	var likesCount, dislikesCount int
	var userReaction string
	h.DB.QueryRow(`SELECT COUNT(*) FROM post_likes WHERE post_id = ? AND reaction = 'like'`, postID).Scan(&likesCount)
	h.DB.QueryRow(`SELECT COUNT(*) FROM post_likes WHERE post_id = ? AND reaction = 'dislike'`, postID).Scan(&dislikesCount)
	h.DB.QueryRow(`SELECT reaction FROM post_likes WHERE post_id = ? AND user_id = ?`, postID, currentUser.ID).Scan(&userReaction)

	result := map[string]interface{}{
		"id":	p.ID, "user_id": p.UserID, "content": p.Content,
		"image":	p.Image, "privacy": p.Privacy, "created_at": p.CreatedAt,
		"likes_count":	likesCount, "dislikes_count": dislikesCount, "user_reaction": userReaction,
		"author": map[string]string{
			"id":	p.UserID, "first_name": firstName, "last_name": lastName,
			"avatar":	avatar, "nickname": nickname,
		},
		"comments":	comments,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *PostHandler) DeletePost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	postID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	var ownerID string
	h.DB.QueryRow(`SELECT user_id FROM posts WHERE id = ?`, postID).Scan(&ownerID)
	if ownerID != currentUser.ID {
		JSONError(w, "Forbidden", http.StatusForbidden)
		return
	}

	h.DB.Exec(`DELETE FROM posts WHERE id = ?`, postID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Post deleted"})
}

func (h *PostHandler) ReactPost(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	postID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	var body struct {
		Reaction string `json:"reaction"`
	}
	json.NewDecoder(r.Body).Decode(&body)
	if body.Reaction != "like" && body.Reaction != "dislike" {
		JSONError(w, "Invalid reaction", http.StatusBadRequest)
		return
	}

	var existing string
	err := h.DB.QueryRow(`SELECT reaction FROM post_likes WHERE post_id = ? AND user_id = ?`, postID, currentUser.ID).Scan(&existing)
	if err == nil {
		if existing == body.Reaction {
			h.DB.Exec(`DELETE FROM post_likes WHERE post_id = ? AND user_id = ?`, postID, currentUser.ID)
		} else {
			h.DB.Exec(`UPDATE post_likes SET reaction = ? WHERE post_id = ? AND user_id = ?`, body.Reaction, postID, currentUser.ID)
		}
	} else {
		h.DB.Exec(`INSERT INTO post_likes (post_id, user_id, reaction) VALUES (?, ?, ?)`, postID, currentUser.ID, body.Reaction)
	}

	var likesCount, dislikesCount int
	h.DB.QueryRow(`SELECT COUNT(*) FROM post_likes WHERE post_id = ? AND reaction = 'like'`, postID).Scan(&likesCount)
	h.DB.QueryRow(`SELECT COUNT(*) FROM post_likes WHERE post_id = ? AND reaction = 'dislike'`, postID).Scan(&dislikesCount)
	var userReaction string
	h.DB.QueryRow(`SELECT reaction FROM post_likes WHERE post_id = ? AND user_id = ?`, postID, currentUser.ID).Scan(&userReaction)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"likes_count":		likesCount,
		"dislikes_count":	dislikesCount,
		"user_reaction":	userReaction,
	})
}

func (h *PostHandler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	commentID := vars["comment_id"]
	currentUser := middleware.GetUserFromContext(r)

	var ownerID string
	err := h.DB.QueryRow(`SELECT user_id FROM comments WHERE id = ?`, commentID).Scan(&ownerID)
	if err != nil {
		JSONError(w, "Comment not found", http.StatusNotFound)
		return
	}
	if ownerID != currentUser.ID {
		JSONError(w, "Forbidden", http.StatusForbidden)
		return
	}

	h.DB.Exec(`DELETE FROM comments WHERE id = ?`, commentID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Comment deleted"})
}

func (h *PostHandler) CreateComment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	postID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		r.ParseForm()
	}

	content := r.FormValue("content")
	if content == "" {
		JSONError(w, "Content required", http.StatusBadRequest)
		return
	}

	var p models.Post
	err := h.DB.QueryRow(`SELECT id, user_id, privacy FROM posts WHERE id = ?`, postID).
		Scan(&p.ID, &p.UserID, &p.Privacy)
	if err != nil {
		JSONError(w, "Post not found", http.StatusNotFound)
		return
	}
	if !canViewPost(h.DB, &p, currentUser) {
		JSONError(w, "Forbidden", http.StatusForbidden)
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
		`INSERT INTO comments (id, post_id, user_id, content, image, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
		id.String(), postID, currentUser.ID, content, image, now,
	)

	comment := map[string]interface{}{
		"id":	id.String(), "post_id": postID, "user_id": currentUser.ID,
		"content":	content, "image": image, "created_at": now,
		"author": map[string]string{
			"id":	currentUser.ID, "first_name": currentUser.FirstName,
			"last_name":	currentUser.LastName, "avatar": currentUser.Avatar,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(comment)
}

func (h *PostHandler) GetComments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	postID := vars["id"]

	comments := h.getComments(postID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(comments)
}

func (h *PostHandler) getComments(postID string) []map[string]interface{} {
	rows, err := h.DB.Query(
		`SELECT c.id, c.post_id, c.user_id, c.content, c.image, c.created_at,
		        u.first_name, u.last_name, u.avatar
		 FROM comments c JOIN users u ON u.id = c.user_id
		 WHERE c.post_id = ? ORDER BY c.created_at ASC`, postID,
	)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()

	var comments []map[string]interface{}
	for rows.Next() {
		var id, pid, uid, content, image string
		var createdAt time.Time
		var fn, ln, av string
		rows.Scan(&id, &pid, &uid, &content, &image, &createdAt, &fn, &ln, &av)
		comments = append(comments, map[string]interface{}{
			"id":	id, "post_id": pid, "user_id": uid, "content": content,
			"image":	image, "created_at": createdAt,
			"author": map[string]string{
				"id":	uid, "first_name": fn, "last_name": ln, "avatar": av,
			},
		})
	}
	if comments == nil {
		comments = []map[string]interface{}{}
	}
	return comments
}

func canViewPost(db *sql.DB, p *models.Post, viewer *models.User) bool {
	if viewer != nil && viewer.ID == p.UserID {
		return true
	}
	if p.Privacy == "public" {
		return true
	}
	if viewer == nil {
		return false
	}
	if p.Privacy == "almost_private" {
		var cnt int
		db.QueryRow(
			`SELECT COUNT(*) FROM followers WHERE follower_id = ? AND following_id = ? AND status = 'accepted'`,
			viewer.ID, p.UserID,
		).Scan(&cnt)
		return cnt > 0
	}
	if p.Privacy == "private" {
		var cnt int
		db.QueryRow(
			`SELECT COUNT(*) FROM post_viewers WHERE post_id = ? AND user_id = ?`,
			p.ID, viewer.ID,
		).Scan(&cnt)
		return cnt > 0
	}
	return false
}
