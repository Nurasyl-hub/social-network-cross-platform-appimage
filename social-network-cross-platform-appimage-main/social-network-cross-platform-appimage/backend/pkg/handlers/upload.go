package handlers

import (
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofrs/uuid"
)

var allowedExts = map[string]bool{
	".jpg":		true,
	".jpeg":	true,
	".png":		true,
	".gif":		true,
}

func SaveUploadedFile(file multipart.File, fh *multipart.FileHeader) (string, error) {
	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if !allowedExts[ext] {
		return "", fmt.Errorf("unsupported file type: %s", ext)
	}

	id, _ := uuid.NewV4()
	filename := id.String() + ext
	uploadDir := "./uploads"

	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return "", err
	}

	dst, err := os.Create(filepath.Join(uploadDir, filename))
	if err != nil {
		return "", err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return "", err
	}

	return "/uploads/" + filename, nil
}
