package middleware

import (
	"context"
	"database/sql"
	"net/http"
	"time"

	"social-network/pkg/models"
)

type contextKey string

const UserContextKey contextKey = "user"

func AuthMiddleware(db *sql.DB, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session_token")
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		var session models.Session
		var userID string
		err = db.QueryRow(
			`SELECT id, user_id, expires_at FROM sessions WHERE id = ?`,
			cookie.Value,
		).Scan(&session.ID, &userID, &session.ExpiresAt)
		if err != nil {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		if time.Now().After(session.ExpiresAt) {
			db.Exec(`DELETE FROM sessions WHERE id = ?`, cookie.Value)
			http.Error(w, "Session expired", http.StatusUnauthorized)
			return
		}

		var user models.User
		err = db.QueryRow(
			`SELECT id, email, first_name, last_name, date_of_birth, avatar, nickname, about_me, is_public, created_at 
			 FROM users WHERE id = ?`,
			userID,
		).Scan(
			&user.ID, &user.Email, &user.FirstName, &user.LastName,
			&user.DateOfBirth, &user.Avatar, &user.Nickname, &user.AboutMe,
			&user.IsPublic, &user.CreatedAt,
		)
		if err != nil {
			http.Error(w, "User not found", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), UserContextKey, &user)
		next.ServeHTTP(w, r.WithContext(ctx))
	}
}

func GetUserFromContext(r *http.Request) *models.User {
	user, _ := r.Context().Value(UserContextKey).(*models.User)
	return user
}
