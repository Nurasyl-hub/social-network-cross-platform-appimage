package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gofrs/uuid"
	"social-network/pkg/middleware"
	"social-network/pkg/models"
)

type AuthHandler struct {
	DB *sql.DB
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(10 << 20); err != nil {
		r.ParseForm()
	}

	email := r.FormValue("email")
	password := r.FormValue("password")
	firstName := r.FormValue("first_name")
	lastName := r.FormValue("last_name")
	dob := r.FormValue("date_of_birth")
	nickname := r.FormValue("nickname")
	aboutMe := r.FormValue("about_me")

	if email == "" || password == "" || firstName == "" || lastName == "" || dob == "" {
		JSONError(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	var existing string
	err := h.DB.QueryRow(`SELECT id FROM users WHERE email = ?`, email).Scan(&existing)
	if err == nil {
		JSONError(w, "Email already registered", http.StatusConflict)
		return
	}

	hash, err := hashPassword(password)
	if err != nil {
		JSONError(w, "Internal error", http.StatusInternalServerError)
		return
	}

	id, _ := uuid.NewV4()

	avatar := ""
	file, fh, err := r.FormFile("avatar")
	if err == nil {
		defer file.Close()
		avatar, _ = SaveUploadedFile(file, fh)
	}

	_, err = h.DB.Exec(
		`INSERT INTO users (id, email, password, first_name, last_name, date_of_birth, avatar, nickname, about_me, is_public)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
		id.String(), email, hash, firstName, lastName, dob, avatar, nickname, aboutMe,
	)
	if err != nil {
		JSONError(w, "Failed to create user: "+err.Error(), http.StatusInternalServerError)
		return
	}

	session := createSession(h.DB, id.String())
	setSessionCookie(w, session.ID, session.ExpiresAt)

	user := models.User{
		ID:	id.String(), Email: email, FirstName: firstName,
		LastName:	lastName, DateOfBirth: dob, Avatar: avatar,
		Nickname:	nickname, AboutMe: aboutMe, IsPublic: true,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"user": user})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var body struct {
		Email		string	`json:"email"`
		Password	string	`json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		JSONError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var user models.User
	var hash string
	err := h.DB.QueryRow(
		`SELECT id, email, password, first_name, last_name, date_of_birth, avatar, nickname, about_me, is_public, created_at
		 FROM users WHERE email = ?`,
		body.Email,
	).Scan(&user.ID, &user.Email, &hash, &user.FirstName, &user.LastName,
		&user.DateOfBirth, &user.Avatar, &user.Nickname, &user.AboutMe, &user.IsPublic, &user.CreatedAt)

	if err != nil {
		JSONError(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	if err := checkPassword(body.Password, hash); err != nil {
		JSONError(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	session := createSession(h.DB, user.ID)
	setSessionCookie(w, session.ID, session.ExpiresAt)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"user": user})
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie("session_token")
	if err == nil {
		h.DB.Exec(`DELETE FROM sessions WHERE id = ?`, cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name:	"session_token", Value: "", Path: "/",
		Expires:	time.Unix(0, 0), HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Logged out"})
}

func (h *AuthHandler) Check(w http.ResponseWriter, r *http.Request) {
	user := middleware.GetUserFromContext(r)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{"user": user})
}

func createSession(db *sql.DB, userID string) models.Session {
	id, _ := uuid.NewV4()
	expires := time.Now().Add(7 * 24 * time.Hour)
	db.Exec(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`, id.String(), userID, expires)
	return models.Session{ID: id.String(), UserID: userID, ExpiresAt: expires}
}

func setSessionCookie(w http.ResponseWriter, sessionID string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:	"session_token", Value: sessionID, Path: "/",
		Expires:	expires, HttpOnly: true, SameSite: http.SameSiteLaxMode,
	})
}

func JSONError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
