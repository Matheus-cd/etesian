package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chiMiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/etesian/backend/internal/adapter/http/handler"
	"github.com/etesian/backend/internal/adapter/http/middleware"
	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
	"github.com/etesian/backend/internal/domain/service"
	"github.com/etesian/backend/internal/infrastructure/crypto"
)

type Router struct {
	authHandler      *handler.AuthHandler
	userHandler      *handler.UserHandler
	techniqueHandler *handler.TechniqueHandler
	clientHandler    *handler.ClientHandler
	exerciseHandler  *handler.ExerciseHandler
	executionHandler *handler.ExecutionHandler
	detectionHandler *handler.DetectionHandler
	reportHandler    *handler.ReportHandler

	authMiddleware     *middleware.AuthMiddleware
	exerciseMiddleware *middleware.ExerciseAccessMiddleware
}

func NewRouter(
	userRepo repository.UserRepository,
	tokenRepo repository.RefreshTokenRepository,
	techniqueRepo repository.TechniqueRepository,
	clientRepo repository.ClientRepository,
	exerciseRepo repository.ExerciseRepository,
	memberRepo repository.ExerciseMemberRepository,
	exerciseTechniqueRepo repository.ExerciseTechniqueRepository,
	executionRepo repository.ExecutionRepository,
	detectionRepo repository.DetectionRepository,
	voidRepo repository.DetectionVoidRepository,
	evidenceRepo repository.EvidenceRepository,
	jwtManager *crypto.JWTManager,
) *Router {
	// Create the detection stats service for unified calculation
	detectionStatsService := service.NewDetectionStatsService(executionRepo, detectionRepo)

	return &Router{
		authHandler:      handler.NewAuthHandler(userRepo, tokenRepo, jwtManager),
		userHandler:      handler.NewUserHandler(userRepo),
		techniqueHandler: handler.NewTechniqueHandler(techniqueRepo),
		clientHandler:    handler.NewClientHandler(clientRepo),
		exerciseHandler:  handler.NewExerciseHandler(exerciseRepo, memberRepo, exerciseTechniqueRepo, userRepo, clientRepo, detectionStatsService),
		executionHandler: handler.NewExecutionHandler(executionRepo, detectionRepo, voidRepo, evidenceRepo),
		detectionHandler: handler.NewDetectionHandler(detectionRepo, voidRepo, evidenceRepo, executionRepo),
		reportHandler:    handler.NewReportHandler(clientRepo, exerciseRepo, memberRepo, exerciseTechniqueRepo, executionRepo, detectionRepo, evidenceRepo, userRepo, detectionStatsService),

		authMiddleware:     middleware.NewAuthMiddleware(jwtManager),
		exerciseMiddleware: middleware.NewExerciseAccessMiddleware(exerciseRepo),
	}
}

func (rt *Router) Setup() http.Handler {
	r := chi.NewRouter()

	// Global middleware
	r.Use(chiMiddleware.Logger)
	r.Use(chiMiddleware.Recoverer)
	r.Use(chiMiddleware.RequestID)
	r.Use(chiMiddleware.RealIP)

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// Public routes (no auth required)
		r.Group(func(r chi.Router) {
			r.Post("/auth/login", rt.authHandler.Login)
			r.Post("/auth/refresh", rt.authHandler.RefreshToken)
			// MFA setup routes (require setup_token, not full auth)
			r.Post("/auth/mfa/setup", rt.authHandler.MFASetup)
			r.Post("/auth/mfa/verify", rt.authHandler.MFAVerify)
		})

		// Protected routes (auth required)
		r.Group(func(r chi.Router) {
			r.Use(rt.authMiddleware.Authenticate)

			// Auth
			r.Post("/auth/logout", rt.authHandler.Logout)
			r.Get("/auth/me", rt.authHandler.Me)

			// Users (admin only)
			r.Route("/users", func(r chi.Router) {
				r.Use(middleware.RequireAdmin)
				r.Get("/", rt.userHandler.List)
				r.Post("/", rt.userHandler.Create)
				r.Get("/{id}", rt.userHandler.Get)
				r.Put("/{id}", rt.userHandler.Update)
				r.Delete("/{id}", rt.userHandler.Delete)
				r.Post("/{id}/reset-mfa", rt.userHandler.ResetMFA)
			})

			// Techniques (lead or admin can manage, others can view)
			r.Route("/techniques", func(r chi.Router) {
				r.Get("/", rt.techniqueHandler.List)
				r.Get("/tactics", rt.techniqueHandler.GetTactics)
				r.Get("/{id}", rt.techniqueHandler.Get)

				r.Group(func(r chi.Router) {
					r.Use(middleware.RequireLeadOrAdmin)
					r.Post("/", rt.techniqueHandler.Create)
					r.Post("/import-stix", rt.techniqueHandler.ImportSTIX)
					r.Put("/{id}", rt.techniqueHandler.Update)
					r.Delete("/{id}", rt.techniqueHandler.Delete)
				})
			})

			// Clients (lead or admin can manage, others can view)
			r.Route("/clients", func(r chi.Router) {
				r.Get("/", rt.clientHandler.List)
				r.Get("/{clientID}", rt.clientHandler.Get)

				r.Group(func(r chi.Router) {
					r.Use(middleware.RequireLeadOrAdmin)
					r.Post("/", rt.clientHandler.Create)
					r.Put("/{clientID}", rt.clientHandler.Update)
					r.Delete("/{clientID}", rt.clientHandler.Delete)
				})
			})

			// Exercises
			r.Route("/exercises", func(r chi.Router) {
				r.Get("/", rt.exerciseHandler.List)

				// Create exercise (lead or admin)
				r.Group(func(r chi.Router) {
					r.Use(middleware.RequireLeadOrAdmin)
					r.Post("/", rt.exerciseHandler.Create)
				})

				// Exercise-specific routes (requires exercise access)
				r.Route("/{exerciseID}", func(r chi.Router) {
					r.Use(rt.exerciseMiddleware.RequireExerciseAccess)

					r.Get("/", rt.exerciseHandler.Get)
					r.Get("/techniques", rt.exerciseHandler.ListTechniques)
					r.Get("/executions", rt.executionHandler.ListByExercise)
					r.Get("/detections", rt.detectionHandler.ListByExercise)
					r.Get("/members", rt.exerciseHandler.ListMembers)
					r.Get("/detection-stats", rt.exerciseHandler.GetDetectionStats)

					// Manage exercise (lead or admin)
					r.Group(func(r chi.Router) {
						r.Use(middleware.RequireLeadOrAdmin)
						r.Put("/", rt.exerciseHandler.Update)
						r.Delete("/", rt.exerciseHandler.Delete)
						r.Post("/start", rt.exerciseHandler.Start)
						r.Post("/complete", rt.exerciseHandler.Complete)
						r.Post("/reopen", rt.exerciseHandler.Reopen)

						// Members management (add/remove)
						r.Post("/members", rt.exerciseHandler.AddMember)
						r.Delete("/members/{userID}", rt.exerciseHandler.RemoveMember)
					})

					// Techniques in exercise management
					r.Group(func(r chi.Router) {
						r.Use(middleware.RequireRedTeamOrLeadOrAdmin)
						r.Post("/techniques", rt.exerciseHandler.AddTechnique)
						r.Post("/techniques/reorder", rt.exerciseHandler.ReorderTechniques)
					})

					// Technique details and operations
					r.Route("/techniques/{techniqueID}", func(r chi.Router) {
						r.Get("/", rt.exerciseHandler.GetTechnique)
						r.Get("/executions", rt.executionHandler.ListByTechnique)

						// Update and delete (Red Team, Lead, or Admin)
						r.Group(func(r chi.Router) {
							r.Use(middleware.RequireRedTeamOrLeadOrAdmin)
							r.Put("/", rt.exerciseHandler.UpdateExerciseTechnique)
							r.Delete("/", rt.exerciseHandler.RemoveTechnique)
							r.Patch("/schedule", rt.exerciseHandler.ScheduleTechnique)
						})

						// Status control (Red Team or Lead)
						r.Group(func(r chi.Router) {
							r.Use(middleware.RequireExerciseRole(entity.RoleInExerciseRedTeam, entity.RoleInExerciseLead))
							r.Post("/start", rt.exerciseHandler.StartTechnique)
							r.Post("/pause", rt.exerciseHandler.PauseTechnique)
							r.Post("/resume", rt.exerciseHandler.ResumeTechnique)
							r.Post("/complete", rt.exerciseHandler.CompleteTechnique)
							r.Post("/reopen", rt.exerciseHandler.ReopenTechnique)
						})
					})

					// Executions (Red Team or Lead can create/update)
					r.Route("/executions", func(r chi.Router) {
						r.Group(func(r chi.Router) {
							r.Use(middleware.RequireExerciseRole(entity.RoleInExerciseRedTeam, entity.RoleInExerciseLead))
							r.Post("/", rt.executionHandler.Create)
						})
					})

					// Detections (Blue Team or Lead can create/update)
					r.Route("/detections", func(r chi.Router) {
						r.Group(func(r chi.Router) {
							r.Use(middleware.RequireExerciseRole(entity.RoleInExerciseBlueTeam, entity.RoleInExerciseLead))
							r.Post("/", rt.detectionHandler.Create)
						})
					})
				})
			})

			// Execution routes
			r.Route("/executions/{executionID}", func(r chi.Router) {
				// Read operations - any authenticated user with exercise access can view
				r.Get("/", rt.executionHandler.Get)
				r.Get("/detections", rt.detectionHandler.ListByExecution)

				// Write operations - Red Team, Lead, or Admin only
				r.Group(func(r chi.Router) {
					r.Use(middleware.RequireRedTeamOrLeadOrAdmin)
					r.Put("/", rt.executionHandler.Update)
					r.Delete("/", rt.executionHandler.Delete)
					r.Post("/evidences", rt.executionHandler.UploadEvidence)
					r.Put("/evidences/{evidenceID}", rt.executionHandler.UpdateEvidenceCaption)
					r.Delete("/evidences/{evidenceID}", rt.executionHandler.DeleteEvidence)
				})
			})

			// Evidence file serving (images only)
			r.Get("/evidences/{evidenceID}/file", rt.executionHandler.GetEvidenceFile)

			// Detection routes
			r.Route("/detections/{detectionID}", func(r chi.Router) {
				// Read operations - any authenticated user can view
				r.Get("/", rt.detectionHandler.Get)

				// Write operations - Blue Team, Lead, or Admin only
				r.Group(func(r chi.Router) {
					r.Use(middleware.RequireBlueTeamOrLeadOrAdmin)
					r.Put("/", rt.detectionHandler.Update)
					r.Delete("/", rt.detectionHandler.Delete)
					r.Post("/evidences", rt.detectionHandler.UploadEvidence)
					r.Put("/evidences/{evidenceID}", rt.detectionHandler.UpdateEvidenceCaption)
					r.Delete("/evidences/{evidenceID}", rt.detectionHandler.DeleteEvidence)
				})

				// Void detection (Red Team or Lead)
				r.Group(func(r chi.Router) {
					r.Use(middleware.RequireRedTeamOrLeadOrAdmin)
					r.Post("/void", rt.detectionHandler.Void)
				})
			})

			// Reports (lead or admin only)
			r.Route("/reports", func(r chi.Router) {
				r.Use(middleware.RequireLeadOrAdmin)
				r.Get("/clients", rt.reportHandler.ListClientsWithExercises)
				r.Get("/clients/{clientID}/exercises", rt.reportHandler.GetClientExercises)
				r.Get("/exercises/{exerciseID}", rt.reportHandler.GetExerciseReport)
			})
		})
	})

	return r
}
