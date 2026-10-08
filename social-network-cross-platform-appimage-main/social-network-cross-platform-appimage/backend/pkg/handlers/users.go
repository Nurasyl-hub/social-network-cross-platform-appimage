package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"social-network/pkg/middleware"
	"social-network/pkg/models"
)

type UserHandler struct {
	DB *sql.DB
}

func (h *UserHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	targetID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	var user models.User
	err := h.DB.QueryRow(
		`SELECT id, email, first_name, last_name, date_of_birth, avatar, nickname, about_me, is_public, created_at
		 FROM users WHERE id = ?`, targetID,
	).Scan(&user.ID, &user.Email, &user.FirstName, &user.LastName, &user.DateOfBirth,
		&user.Avatar, &user.Nickname, &user.AboutMe, &user.IsPublic, &user.CreatedAt)
	if err != nil {
		JSONError(w, "User not found", http.StatusNotFound)
		return
	}

	isOwner := currentUser != nil && currentUser.ID == targetID
	isFollowing := false
	if currentUser != nil && !isOwner {
		var cnt int
		h.DB.QueryRow(
			`SELECT COUNT(*) FROM followers WHERE follower_id = ? AND following_id = ? AND status = 'accepted'`,
			currentUser.ID, targetID,
		).Scan(&cnt)
		isFollowing = cnt > 0
	}

	canSee := isOwner || user.IsPublic || isFollowing

	var followerCount, followingCount int
	h.DB.QueryRow(`SELECT COUNT(*) FROM followers WHERE following_id = ? AND status = 'accepted'`, targetID).Scan(&followerCount)
	h.DB.QueryRow(`SELECT COUNT(*) FROM followers WHERE follower_id = ? AND status = 'accepted'`, targetID).Scan(&followingCount)

	resp := map[string]interface{}{
		"user":			user,
		"is_owner":		isOwner,
		"is_following":		isFollowing,
		"follower_count":	followerCount,
		"following_count":	followingCount,
		"can_see":		canSee,
	}

	if canSee {

		posts := h.getUserPosts(targetID, currentUser)
		resp["posts"] = posts

		followers := h.getFollowersList(targetID)
		resp["followers"] = followers

		following := h.getFollowingList(targetID)
		resp["following"] = following
	}

	if currentUser != nil && !isOwner {
		var status string
		err := h.DB.QueryRow(
			`SELECT status FROM followers WHERE follower_id = ? AND following_id = ?`,
			currentUser.ID, targetID,
		).Scan(&status)
		if err == nil {
			resp["follow_status"] = status
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *UserHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	targetID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	if currentUser.ID != targetID {
		JSONError(w, "Forbidden", http.StatusForbidden)
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		r.ParseForm()
	}

	nickname := r.FormValue("nickname")
	aboutMe := r.FormValue("about_me")
	firstName := r.FormValue("first_name")
	lastName := r.FormValue("last_name")
	dob := r.FormValue("date_of_birth")

	avatar := currentUser.Avatar
	file, fh, err := r.FormFile("avatar")
	if err == nil {
		defer file.Close()
		if newAvatar, err := SaveUploadedFile(file, fh); err == nil {
			avatar = newAvatar
		}
	}

	_, err = h.DB.Exec(
		`UPDATE users SET first_name=?, last_name=?, date_of_birth=?, avatar=?, nickname=?, about_me=? WHERE id=?`,
		firstName, lastName, dob, avatar, nickname, aboutMe, targetID,
	)
	if err != nil {
		JSONError(w, "Update failed", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Profile updated"})
}

func (h *UserHandler) TogglePrivacy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	targetID := vars["id"]
	currentUser := middleware.GetUserFromContext(r)

	if currentUser.ID != targetID {
		JSONError(w, "Forbidden", http.StatusForbidden)
		return
	}

	var isPublic bool
	h.DB.QueryRow(`SELECT is_public FROM users WHERE id = ?`, targetID).Scan(&isPublic)
	newVal := 0
	if !isPublic {
		newVal = 1
	}
	h.DB.Exec(`UPDATE users SET is_public = ? WHERE id = ?`, newVal, targetID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"is_public": newVal == 1})
}

func (h *UserHandler) SearchUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	currentUser := middleware.GetUserFromContext(r)

	rows, err := h.DB.Query(
		`SELECT id, first_name, last_name, avatar, nickname, is_public FROM users
		 WHERE (first_name LIKE ? OR last_name LIKE ? OR nickname LIKE ? OR email LIKE ?)
		 AND id != ? LIMIT 20`,
		"%"+q+"%", "%"+q+"%", "%"+q+"%", "%"+q+"%", currentUser.ID,
	)
	if err != nil {
		JSONError(w, "Search failed", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id, firstName, lastName, avatar, nickname string
		var isPublic bool
		rows.Scan(&id, &firstName, &lastName, &avatar, &nickname, &isPublic)
		users = append(users, map[string]interface{}{
			"id":	id, "first_name": firstName, "last_name": lastName,
			"avatar":	avatar, "nickname": nickname, "is_public": isPublic,
		})
	}
	if users == nil {
		users = []map[string]interface{}{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func (h *UserHandler) getUserPosts(userID string, viewer *models.User) []models.Post {
	var posts []models.Post

	rows, err := h.DB.Query(
		`SELECT id, user_id, content, image, privacy, created_at FROM posts
		 WHERE user_id = ? ORDER BY created_at DESC`, userID,
	)
	if err != nil {
		return posts
	}
	defer rows.Close()

	for rows.Next() {
		var p models.Post
		rows.Scan(&p.ID, &p.UserID, &p.Content, &p.Image, &p.Privacy, &p.CreatedAt)

		visible := false
		if viewer != nil && viewer.ID == userID {
			visible = true
		} else if p.Privacy == "public" {
			visible = true
		} else if viewer != nil && p.Privacy == "almost_private" {
			var cnt int
			h.DB.QueryRow(
				`SELECT COUNT(*) FROM followers WHERE follower_id = ? AND following_id = ? AND status = 'accepted'`,
				viewer.ID, userID,
			).Scan(&cnt)
			visible = cnt > 0
		} else if viewer != nil && p.Privacy == "private" {
			var cnt int
			h.DB.QueryRow(
				`SELECT COUNT(*) FROM post_viewers WHERE post_id = ? AND user_id = ?`,
				p.ID, viewer.ID,
			).Scan(&cnt)
			visible = cnt > 0
		}

		if visible {
			posts = append(posts, p)
		}
	}
	if posts == nil {
		posts = []models.Post{}
	}
	return posts
}

func (h *UserHandler) getFollowersList(userID string) []models.User {
	var users []models.User
	rows, _ := h.DB.Query(
		`SELECT u.id, u.first_name, u.last_name, u.avatar, u.nickname FROM users u
		 JOIN followers f ON f.follower_id = u.id
		 WHERE f.following_id = ? AND f.status = 'accepted'`, userID,
	)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var u models.User
			rows.Scan(&u.ID, &u.FirstName, &u.LastName, &u.Avatar, &u.Nickname)
			users = append(users, u)
		}
	}
	if users == nil {
		users = []models.User{}
	}
	return users
}

func (h *UserHandler) getFollowingList(userID string) []models.User {
	var users []models.User
	rows, _ := h.DB.Query(
		`SELECT u.id, u.first_name, u.last_name, u.avatar, u.nickname FROM users u
		 JOIN followers f ON f.following_id = u.id
		 WHERE f.follower_id = ? AND f.status = 'accepted'`, userID,
	)
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var u models.User
			rows.Scan(&u.ID, &u.FirstName, &u.LastName, &u.Avatar, &u.Nickname)
			users = append(users, u)
		}
	}
	if users == nil {
		users = []models.User{}
	}
	return users
}
