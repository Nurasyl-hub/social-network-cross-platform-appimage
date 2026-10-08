package sqlite

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB(dbPath string) (*sql.DB, error) {
	dir := filepath.Dir(dbPath)
	if dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create db directory: %w", err)
		}
	}

	db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return nil, err
	}
	if err = db.Ping(); err != nil {
		return nil, err
	}
	DB = db
	log.Println("Database connected:", dbPath)
	return db, nil
}

func RunMigrations(db *sql.DB, migrationsPath string) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`)
	if err != nil {
		return fmt.Errorf("migrations table: %w", err)
	}

	entries, err := os.ReadDir(migrationsPath)
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	var upFiles []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".up.sql") {
			upFiles = append(upFiles, e.Name())
		}
	}
	sort.Strings(upFiles)

	applied := 0
	for _, filename := range upFiles {
		version := strings.TrimSuffix(filename, ".up.sql")
		var count int
		db.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = ?`, version).Scan(&count)
		if count > 0 {
			continue
		}

		content, err := os.ReadFile(filepath.Join(migrationsPath, filename))
		if err != nil {
			return fmt.Errorf("read %s: %w", filename, err)
		}

		for _, stmt := range strings.Split(string(content), ";") {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}
			if _, err := db.Exec(stmt); err != nil {
				return fmt.Errorf("exec %s: %w\n%s", filename, err, stmt)
			}
		}

		db.Exec(`INSERT INTO schema_migrations (version) VALUES (?)`, version)
		log.Printf("Migration applied: %s", filename)
		applied++
	}

	if applied == 0 {
		log.Println("No new migrations")
	} else {
		log.Printf("Applied %d migration(s)", applied)
	}
	return nil
}
