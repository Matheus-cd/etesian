package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	httpAdapter "github.com/etesian/backend/internal/adapter/http"
	"github.com/etesian/backend/internal/adapter/repository/postgres"
	"github.com/etesian/backend/internal/infrastructure/config"
	"github.com/etesian/backend/internal/infrastructure/crypto"
	"github.com/etesian/backend/internal/infrastructure/database"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Connect to database
	db, err := database.NewPostgresConnection(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	log.Println("Connected to database")

	// Initialize repositories
	userRepo := postgres.NewUserRepository(db)
	tokenRepo := postgres.NewRefreshTokenRepository(db)
	techniqueRepo := postgres.NewTechniqueRepository(db)
	clientRepo := postgres.NewClientRepository(db)
	exerciseRepo := postgres.NewExerciseRepository(db)
	memberRepo := postgres.NewExerciseMemberRepository(db)
	exerciseTechniqueRepo := postgres.NewExerciseTechniqueRepository(db)
	executionRepo := postgres.NewExecutionRepository(db)
	detectionRepo := postgres.NewDetectionRepository(db)
	voidRepo := postgres.NewDetectionVoidRepository(db)
	evidenceRepo := postgres.NewEvidenceRepository(db)

	// Initialize JWT manager
	jwtManager := crypto.NewJWTManager(
		cfg.JWT.SecretKey,
		cfg.JWT.AccessTokenTTL,
		cfg.JWT.RefreshTokenTTL,
		cfg.JWT.Issuer,
	)

	// Initialize router
	router := httpAdapter.NewRouter(
		userRepo,
		tokenRepo,
		techniqueRepo,
		clientRepo,
		exerciseRepo,
		memberRepo,
		exerciseTechniqueRepo,
		executionRepo,
		detectionRepo,
		voidRepo,
		evidenceRepo,
		jwtManager,
	)

	// Create HTTP server
	server := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      router.Setup(),
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}

	// Start server in goroutine
	go func() {
		log.Printf("Starting server on port %s", cfg.Server.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("Server shutdown failed: %v", err)
	}

	log.Println("Server exited")
}
