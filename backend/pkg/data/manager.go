package data

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/go-sql-driver/mysql"
)

type Manager struct {
	DB *sql.DB
}

func New(dbUser string, dbPassword string, dbHost string, dbDatabase string) *Manager {

	// Define a formattable string with placeholders for environment variables
	var formattableString = "%s:%s@tcp(%s)/%s"

	// Format the string with the environment variables
	formattedString := fmt.Sprintf(formattableString, dbUser, dbPassword, dbHost, dbDatabase)
	db, err := sql.Open("mysql", formattedString)

	if err != nil {
		log.Fatal("Failed to open database:", err)
		return nil
	}

	err = db.Ping()
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
		return nil
	}

	log.Printf("Successfully connected to database: %s/%s", dbHost, dbDatabase)

	// Create manager
	mgr := &Manager{
		DB: db,
	}

	// Return manager
	return mgr
}
