package main

import (
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"time"

	log "github.com/charmbracelet/log"
	scrypt "github.com/elithrar/simple-scrypt"
	"github.com/joho/godotenv"

	// CL Omega API code
	clomega "clomega/pkg/api"

	// Swagger auto-generated docs
	_ "clomega/docs"

	// http-swagger middleware
	httpSwagger "github.com/swaggo/http-swagger/v2"
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

// loadEnv loads the environment variables from the .env file.
//
// It does not take any parameters.
// It does not return any values.
func loadEnv() {
	err := godotenv.Load(".env")
	if err != nil {
		log.Fatal("Error loading .env file")
	}
}

// beforeRequest is a function that wraps an HTTP handler, gets the IP address of a client using headers (if configured in .env), and logs information about each request.
//
// Each logged entry contains the remote address, method, path, status code and execution time.
//
// It takes a handler as a parameter and returns an http.Handler.
func beforeRequest(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		// Get IP address given headers (if present)
		if os.Getenv("IP_HEADER") != "" && r.Header.Get(os.Getenv("IP_HEADER")) != "" {
			r.RemoteAddr = r.Header.Get(os.Getenv("IP_HEADER"))
		}

		// Color the various possible Methods
		outMethod := fmt.Sprint(r.Method)
		switch outMethod {
		case http.MethodGet:
			// set color to bold green
			outMethod = "\033[32m" + outMethod + "\033[0m"
		case http.MethodPost:
			// set color to yellow
			outMethod = "\033[33m" + outMethod + "\033[0m"
		case http.MethodPut:
			// set color to blue
			outMethod = "\033[34m" + outMethod + "\033[0m"
		case http.MethodDelete:
			// set color to red
			outMethod = "\033[31m" + outMethod + "\033[0m"
		case http.MethodPatch:
			// set color to magenta
			outMethod = "\033[35m" + outMethod + "\033[0m"
		case http.MethodHead:
			// set color to cyan
			outMethod = "\033[36m" + outMethod + "\033[0m"
		default:
			// set color to white
			outMethod = "\033[37m" + outMethod + "\033[0m"
		}

		// Create a new LoggingResponseWriter
		lrw := NewLoggingResponseWriter(w)

		// Get the current time
		currentTime := time.Now()

		// Call the original handler
		handler.ServeHTTP(lrw, r)

		// Get the duration
		duration := fmt.Sprint(time.Since(currentTime))

		// Get the status code
		statusCode := fmt.Sprint(lrw.statusCode)

		// Color the status code based on the class of status code. Default text color uses the default terminal color
		switch statusCode[0] {
		case '1':
			// 1xx informational, set color to blue
			statusCode = "\033[34m" + statusCode + "\033[0m"
		case '2':
			// 2xx success, set color to green
			statusCode = "\033[32m" + statusCode + "\033[0m"
		case '3':
			// 3xx redirection, set color to yellow
			statusCode = "\033[33m" + statusCode + "\033[0m"
		case '4':
			// 4xx client error, set color to magenta
			statusCode = "\033[35m" + statusCode + "\033[0m"
		case '5':
			// 5xx server error, set color to red
			statusCode = "\033[31m" + statusCode + "\033[0m"
		}

		// Log the request
		log.Infof("(%s) %s %s [%s %s]", r.RemoteAddr, outMethod, r.URL.Path, statusCode, duration)
	})
}

// HelloWorld prints "Hello, World!" to the http.ResponseWriter.
//
// The function takes two parameters:
//   - w: an http.ResponseWriter used to write the response.
//   - r: a pointer to an http.Request containing the incoming request.
//
// The function does not return anything.
func HelloWorld(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, "Hello, World!")
}

// @title CloudLink Omega API
// @version 1.0
// @description This API defines the various endpoints that can be used to interact with the CL Omega API.
// @termsOfService http://omega.mikedev101.cc/tos
//
// @contact.name Mike J. Renaker "MikeDEV"
// @contact.email mikierules109@gmail.com
//
// @license.name CC-BY-SA-4.0
// @license.url https://github.com/mikedev101/clomega-backend/blob/main/LICENSE.txt
//
// @host localhost:8080
// @BasePath /docs
func main() {
	loadEnv()

	// Set the log level to debug
	log.SetLevel(log.DebugLevel)

	defaultParams := scrypt.Params{
		N: 16384,
		R: 8,
		P: 1,
	}

	// Calibrate the Scrypt parameters given the defaults
	log.Debug("Calibrating Scrypt parameters...")
	calibratedParams, _ := scrypt.Calibrate(time.Second, 64, defaultParams)
	log.Debugf("Calibrated Scrypt parameters: %v", calibratedParams)

	// Connect to the DB
	db := ConnectToDB(os.Getenv("DB_USER"), os.Getenv("DB_PASS"), os.Getenv("DB_HOST"), os.Getenv("DATABASE"))

	// Configure the Clomega server
	server := &clomega.Config{Database: db, ScryptParams: calibratedParams}

	// Create muxers
	root := http.NewServeMux()
	api := http.NewServeMux()
	swagdocs := http.NewServeMux()

	// Register API endpoints
	api.HandleFunc("/", HelloWorld)
	api.HandleFunc("/register", server.CreateUserHandler)
	api.HandleFunc("/newsession", server.CreateSessionHandler)

	// Register swagger docs
	swagdocs.Handle("/", httpSwagger.Handler(
		httpSwagger.URL("http://localhost:8080/docs/doc.json"),
	))

	// Declare endpoints with the root muxer
	root.Handle("/api/", http.StripPrefix("/api", api))
	root.Handle("/docs/", http.StripPrefix("/docs", swagdocs))

	// Start the server
	log.Info("Server listening on port 8080")
	log.Fatal(http.ListenAndServe(":8080", beforeRequest(root)))
}

type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func NewLoggingResponseWriter(w http.ResponseWriter) *loggingResponseWriter {
	// WriteHeader(int) is not called if our response implicitly returns 200 OK, so
	// we default to that status code.
	return &loggingResponseWriter{w, http.StatusOK}
}

func (lrw *loggingResponseWriter) WriteHeader(code int) {
	lrw.statusCode = code
	lrw.ResponseWriter.WriteHeader(code)
}
