package main

import (
	"log"
	"net/http"
	"os"

	"social-network/pkg/db/sqlite"
	"social-network/pkg/handlers"
	"social-network/pkg/middleware"
	ws "social-network/pkg/websocket"

	"github.com/gorilla/mux"
)

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./social_network.db"
	}

	migrationsPath := os.Getenv("MIGRATIONS_PATH")
	if migrationsPath == "" {
		migrationsPath = "./pkg/db/migrations/sqlite"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	db, err := sqlite.InitDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := sqlite.RunMigrations(db, migrationsPath); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}

	hub := ws.NewHub(db)

	authHandler := &handlers.AuthHandler{DB: db}
	userHandler := &handlers.UserHandler{DB: db}
	followerHandler := &handlers.FollowerHandler{DB: db, Hub: hub}
	postHandler := &handlers.PostHandler{DB: db}
	groupHandler := &handlers.GroupHandler{DB: db, Hub: hub}
	messageHandler := &handlers.MessageHandler{DB: db}
	notifHandler := &handlers.NotificationHandler{DB: db}

	r := mux.NewRouter()

	r.Use(corsMiddleware)

	r.PathPrefix("/uploads/").Handler(
		http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))),
	)

	r.HandleFunc("/api/auth/register", authHandler.Register).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/login", authHandler.Login).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/logout", authHandler.Logout).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/check", middleware.AuthMiddleware(db, authHandler.Check)).Methods("GET", "OPTIONS")

	r.HandleFunc("/api/users/search", middleware.AuthMiddleware(db, userHandler.SearchUsers)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/users/{id}", middleware.AuthMiddleware(db, userHandler.GetProfile)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/users/{id}", middleware.AuthMiddleware(db, userHandler.UpdateProfile)).Methods("PUT", "OPTIONS")
	r.HandleFunc("/api/users/{id}/privacy", middleware.AuthMiddleware(db, userHandler.TogglePrivacy)).Methods("PUT", "OPTIONS")

	r.HandleFunc("/api/follow/{id}", middleware.AuthMiddleware(db, followerHandler.SendFollowRequest)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/follow/{id}/accept", middleware.AuthMiddleware(db, followerHandler.AcceptFollow)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/follow/{id}/decline", middleware.AuthMiddleware(db, followerHandler.DeclineFollow)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/unfollow/{id}", middleware.AuthMiddleware(db, followerHandler.Unfollow)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/follow-requests", middleware.AuthMiddleware(db, followerHandler.GetFollowRequests)).Methods("GET", "OPTIONS")

	r.HandleFunc("/api/posts", middleware.AuthMiddleware(db, postHandler.GetFeed)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/posts", middleware.AuthMiddleware(db, postHandler.CreatePost)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/posts/{id}", middleware.AuthMiddleware(db, postHandler.GetPost)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/posts/{id}", middleware.AuthMiddleware(db, postHandler.DeletePost)).Methods("DELETE", "OPTIONS")
	r.HandleFunc("/api/posts/{id}/react", middleware.AuthMiddleware(db, postHandler.ReactPost)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/posts/{id}/comments", middleware.AuthMiddleware(db, postHandler.GetComments)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/posts/{id}/comments", middleware.AuthMiddleware(db, postHandler.CreateComment)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/posts/{id}/comments/{comment_id}", middleware.AuthMiddleware(db, postHandler.DeleteComment)).Methods("DELETE", "OPTIONS")

	r.HandleFunc("/api/groups", middleware.AuthMiddleware(db, groupHandler.ListGroups)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/groups", middleware.AuthMiddleware(db, groupHandler.CreateGroup)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/groups/{id}", middleware.AuthMiddleware(db, groupHandler.GetGroup)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/groups/{id}", middleware.AuthMiddleware(db, groupHandler.DeleteGroup)).Methods("DELETE", "OPTIONS")
	r.HandleFunc("/api/groups/{id}/invite", middleware.AuthMiddleware(db, groupHandler.InviteUser)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/groups/{id}/join", middleware.AuthMiddleware(db, groupHandler.RequestJoin)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/groups/{id}/posts", middleware.AuthMiddleware(db, groupHandler.GetGroupPosts)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/groups/{id}/posts", middleware.AuthMiddleware(db, groupHandler.CreateGroupPost)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/groups/{id}/posts/{post_id}", middleware.AuthMiddleware(db, groupHandler.DeleteGroupPost)).Methods("DELETE", "OPTIONS")
	r.HandleFunc("/api/groups/{id}/posts/{post_id}/react", middleware.AuthMiddleware(db, groupHandler.ReactGroupPost)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/groups/{id}/posts/{post_id}/comments", middleware.AuthMiddleware(db, groupHandler.GetGroupComments)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/groups/{id}/posts/{post_id}/comments", middleware.AuthMiddleware(db, groupHandler.CreateGroupComment)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/groups/{id}/posts/{post_id}/comments/{comment_id}", middleware.AuthMiddleware(db, groupHandler.DeleteGroupComment)).Methods("DELETE", "OPTIONS")
	r.HandleFunc("/api/groups/{id}/events", middleware.AuthMiddleware(db, groupHandler.GetEvents)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/groups/{id}/events", middleware.AuthMiddleware(db, groupHandler.CreateEvent)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/groups/{id}/events/{event_id}/respond", middleware.AuthMiddleware(db, groupHandler.RespondToEvent)).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/groups/{id}/messages", middleware.AuthMiddleware(db, groupHandler.GetGroupMessages)).Methods("GET", "OPTIONS")

	r.HandleFunc("/api/messages", middleware.AuthMiddleware(db, messageHandler.GetConversations)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/messages/chatable", middleware.AuthMiddleware(db, messageHandler.GetChatableUsers)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/messages/{user_id}", middleware.AuthMiddleware(db, messageHandler.GetMessages)).Methods("GET", "OPTIONS")

	r.HandleFunc("/api/notifications", middleware.AuthMiddleware(db, notifHandler.GetNotifications)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/notifications/unread", middleware.AuthMiddleware(db, notifHandler.GetUnreadCount)).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/notifications/read-all", middleware.AuthMiddleware(db, notifHandler.MarkAllRead)).Methods("PUT", "OPTIONS")
	r.HandleFunc("/api/notifications/{id}/read", middleware.AuthMiddleware(db, notifHandler.MarkRead)).Methods("PUT", "OPTIONS")

	r.HandleFunc("/ws", middleware.AuthMiddleware(db, hub.ServeWS))

	log.Printf("Server starting on port %s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, Cookie")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
