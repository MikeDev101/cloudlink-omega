package main

import (
	"clomega/clomega"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"time"

	_ "clomega/docs"

	log "github.com/charmbracelet/log"
	scrypt "github.com/elithrar/simple-scrypt"
	gin "github.com/gin-gonic/gin"
	godotenv "github.com/joho/godotenv"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

// ConnectToDB connects to the database and returns a *sql.DB object.
//
// It reads the necessary environment variables (DB_USER, DB_PASS, DB_HOST, DATABASE)
// to construct a connection string. Then it opens a MariaDB connection using the
// formatted connection string. If successful, it pings the database to verify the
// connection. If any error occurs during the process, it prints an error message and
// returns nil. Otherwise, it prints a success message and returns the *sql.DB object.
//
// Return:
// - *sql.DB: A pointer to the database connection object.
func ConnectToDB(dbUser string, dbPassword string, dbHost string, dbDatabase string) *sql.DB {

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

	log.Infof("Successfully connected to database: %s/%s", dbHost, dbDatabase)
	return db
}

// HelloWorld prints "Hello, World!" to the http.ResponseWriter.
//
// The function takes two parameters:
//   - c: a *gin.Context used to handle the request and response.
//
// The function does not return anything.
func HelloWorld(c *gin.Context) {
	c.String(http.StatusOK, "Hello, World!")
}

// @title			CloudLink Omega API
// @version		1.0
// @description	This API defines the various endpoints that can be used to interact with the CL Omega API.
//
// @contact.name	Mike J. Renaker "MikeDEV"
// @contact.email	mikierules109@gmail.com
//
// @license.name	MIT
// @license.url	https://github.com/mikedev101/cloudlink-omega/blob/main/LICENSE
//
// @host			localhost:8080
// @BasePath		/
func main() {
	// Load the .env file
	err := godotenv.Load(".env")
	if err != nil {
		log.Fatal("Error loading .env file")
		os.Exit(1)
	}

	// Set the log level to debug
	log.SetLevel(log.DebugLevel)

	// Connect to the DB
	db := ConnectToDB(os.Getenv("DB_USER"), os.Getenv("DB_PASS"), os.Getenv("DB_HOST"), os.Getenv("DATABASE"))

	// Set the default Scrypt parameters
	defaultParams := scrypt.Params{
		N: 16384,
		R: 8,
		P: 1,
	}

	// Calibrate the Scrypt parameters given the defaults
	log.Debug("Calibrating Scrypt parameters...")
	calibratedParams, _ := scrypt.Calibrate(time.Second, 64, defaultParams)
	log.Debugf("Calibrated Scrypt parameters: %v", calibratedParams)

	// Configure env mode
	gin.SetMode(os.Getenv("GIN_MODE"))

	// Create the default gin router
	root := gin.Default()

	// Set IP header
	root.RemoteIPHeaders = []string{os.Getenv("IP_HEADER")}

	// Configure the Clomega server
	_ = clomega.New(
		root,
		"/api",
		clomega.Config{Database: db, ScryptParams: calibratedParams},
	)

	// Add swagger documentation
	root.GET("/docs/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Run the server
	log.Info("Server listening on port 8080")
	log.Fatal(root.Run(":8080"))
}
