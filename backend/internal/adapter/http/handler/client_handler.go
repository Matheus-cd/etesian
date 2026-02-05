package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/etesian/backend/internal/adapter/http/response"
	"github.com/etesian/backend/internal/domain/entity"
	"github.com/etesian/backend/internal/domain/repository"
)

type ClientHandler struct {
	clientRepo repository.ClientRepository
}

func NewClientHandler(clientRepo repository.ClientRepository) *ClientHandler {
	return &ClientHandler{
		clientRepo: clientRepo,
	}
}

type ClientRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type ClientResponse struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

func (h *ClientHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req ClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.Name == "" {
		response.BadRequest(w, "Name is required")
		return
	}

	client := &entity.Client{
		Name: req.Name,
	}

	if req.Description != "" {
		client.Description = &req.Description
	}

	if err := h.clientRepo.Create(r.Context(), client); err != nil {
		response.InternalError(w, "Failed to create client")
		return
	}

	response.Created(w, toClientResponse(client))
}

func (h *ClientHandler) Get(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "clientID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid client ID")
		return
	}

	client, err := h.clientRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if client == nil {
		response.NotFound(w, "Client not found")
		return
	}

	response.Success(w, toClientResponse(client))
}

func (h *ClientHandler) List(w http.ResponseWriter, r *http.Request) {
	clients, err := h.clientRepo.GetAll(r.Context())
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	// Initialize as empty array to avoid returning null in JSON
	clientResponses := make([]ClientResponse, 0, len(clients))
	for _, c := range clients {
		clientResponses = append(clientResponses, toClientResponse(&c))
	}

	response.Success(w, clientResponses)
}

func (h *ClientHandler) Update(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "clientID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid client ID")
		return
	}

	client, err := h.clientRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if client == nil {
		response.NotFound(w, "Client not found")
		return
	}

	var req ClientRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, "Invalid request body")
		return
	}

	if req.Name != "" {
		client.Name = req.Name
	}
	if req.Description != "" {
		client.Description = &req.Description
	}

	if err := h.clientRepo.Update(r.Context(), client); err != nil {
		response.InternalError(w, "Failed to update client")
		return
	}

	response.Success(w, toClientResponse(client))
}

func (h *ClientHandler) Delete(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "clientID")
	id, err := uuid.Parse(idStr)
	if err != nil {
		response.BadRequest(w, "Invalid client ID")
		return
	}

	// Check if client exists
	client, err := h.clientRepo.GetByID(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if client == nil {
		response.NotFound(w, "Client not found")
		return
	}

	// Check if client has associated exercises
	hasExercises, err := h.clientRepo.HasExercises(r.Context(), id)
	if err != nil {
		response.InternalError(w, "Database error")
		return
	}

	if hasExercises {
		response.BadRequest(w, "Cannot delete client with associated exercises")
		return
	}

	if err := h.clientRepo.Delete(r.Context(), id); err != nil {
		response.InternalError(w, "Failed to delete client")
		return
	}

	response.NoContent(w)
}

func toClientResponse(c *entity.Client) ClientResponse {
	return ClientResponse{
		ID:          c.ID.String(),
		Name:        c.Name,
		Description: c.Description,
		CreatedAt:   c.CreatedAt.Format("2006-01-02T15:04:05Z"),
		UpdatedAt:   c.UpdatedAt.Format("2006-01-02T15:04:05Z"),
	}
}
