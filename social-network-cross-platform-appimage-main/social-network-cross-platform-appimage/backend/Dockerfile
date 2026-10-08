FROM golang:1.25-alpine AS builder

RUN apk add --no-cache gcc musl-dev sqlite-dev

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=1 GOOS=linux go build -a -ldflags '-linkmode external -extldflags "-static"' -o server ./server.go

FROM alpine:3.18

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/server .
COPY --from=builder /app/pkg/db/migrations ./pkg/db/migrations

RUN mkdir -p /app/data /app/uploads

ENV PORT=8080
ENV DB_PATH=/app/data/social_network.db
ENV MIGRATIONS_PATH=/app/pkg/db/migrations/sqlite

EXPOSE 8080

CMD ["./server"]
