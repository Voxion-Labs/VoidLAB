package auth

import (
	"fmt"
	"net/http"
)

// JWTMiddleware enforces that incoming requests carry a valid, cryptographically signed JWT.
// It verifies the token from the HTTP-only cookie, Authorization Bearer header, or HX-Auth-Token header.
// If the token is valid, execution proceeds to the next handler.
// If absent, expired, or invalidly signed, it halts the chain and returns HTTP 401 Unauthorized.
func JWTMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		username, ok := GetAuthenticatedUser(r)
		if !ok || username == "" {
			if r.Header.Get("HX-Request") == "true" {
				w.Header().Set("HX-Redirect", "/")
			}
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			w.WriteHeader(http.StatusUnauthorized)
			fmt.Fprint(w, "401 Unauthorized: Valid JWT session required")
			return
		}

		next(w, r)
	}
}

// RequireJWT is an idiomatic alias for JWTMiddleware.
func RequireJWT(next http.HandlerFunc) http.HandlerFunc {
	return JWTMiddleware(next)
}
