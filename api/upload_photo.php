<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// Configuration
$uploadDir = '../uploads/photos/';
$allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
$maxFileSize = 5 * 1024 * 1024; // 5MB

// Create upload directory if it doesn't exist
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

if (!isset($_FILES['photo'])) {
    echo json_encode(['success' => false, 'message' => 'No file uploaded']);
    exit;
}

$file = $_FILES['photo'];

// Validate file type
if (!in_array($file['type'], $allowedTypes)) {
    echo json_encode(['success' => false, 'message' => 'Invalid file type. Only JPG, PNG, and GIF are allowed']);
    exit;
}

// Validate file size
if ($file['size'] > $maxFileSize) {
    echo json_encode(['success' => false, 'message' => 'File is too large. Maximum size is 5MB']);
    exit;
}

// Generate unique filename
$fileExtension = pathinfo($file['name'], PATHINFO_EXTENSION);
$uniqueName = uniqid('photo_', true) . '.' . $fileExtension;
$uploadPath = $uploadDir . $uniqueName;

// Move uploaded file
if (move_uploaded_file($file['tmp_name'], $uploadPath)) {
    echo json_encode([
        'success' => true,
        'message' => 'File uploaded successfully',
        'filename' => $uniqueName,
        'url' => '../uploads/photos/' . $uniqueName
    ]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to upload file']);
}
?>