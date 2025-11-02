<?php
// Disable error display and ensure JSON output
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../php_errors.log');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Max-Age: 3600');
    http_response_code(200);
    exit();
}

// Set CORS headers for actual request
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$content = $data['content'] ?? '';
$type = $data['type'] ?? 'text';
$audience = $data['audience'] ?? 'students';
$course = $data['course'] ?? null;
$layout = $data['layout'] ?? 'image-left';
$images = $data['images'] ?? null;

$conn = getDatabaseConnection();

// Increase max_allowed_packet for large images
$conn->query("SET GLOBAL max_allowed_packet=10485760"); // 10MB

// Debug: Check if images are provided
$hasImages = !empty($images);
$imagesCount = is_array($images) ? count($images) : 0;

// If images are base64 data URLs, they might be very large
// For now, let's limit the size or compress
$imagesJson = null;
if ($images) {
    // If images are base64 strings (very large), truncate or skip
    $imagesArray = is_array($images) ? $images : [$images];
    $processedImages = [];
    
    foreach ($imagesArray as $img) {
        // Store base64 images as-is, but they might be truncated by MySQL TEXT field limit
        // MySQL TEXT can hold up to 65,535 bytes, MEDIUMTEXT can hold 16MB
        // We'll store the full image for now
        $processedImages[] = $img;
    }
    
    // Encode once to JSON string
    $imagesJson = json_encode($processedImages);
    
    error_log("Saving images - count: " . count($processedImages));
    error_log("Images JSON length: " . strlen($imagesJson));
    error_log("First 100 chars of JSON: " . substr($imagesJson, 0, 100));
}

// Check if shares column exists
$sharesCheck = $conn->query("SHOW COLUMNS FROM admin_posts LIKE 'shares'");
$hasShares = $sharesCheck && $sharesCheck->num_rows > 0;

// Build the SQL dynamically based on column existence
if ($hasShares) {
    $stmt = $conn->prepare("INSERT INTO admin_posts (content, type, audience, course, layout, images, author, timestamp, likes, shares, comments) VALUES (?, ?, ?, ?, ?, ?, 'Administrator', NOW(), 0, 0, '[]')");
    $stmt->bind_param("ssssss", $content, $type, $audience, $course, $layout, $imagesJson);
} else {
    $stmt = $conn->prepare("INSERT INTO admin_posts (content, type, audience, course, layout, images, author, timestamp, likes, comments) VALUES (?, ?, ?, ?, ?, ?, 'Administrator', NOW(), 0, '[]')");
    $stmt->bind_param("ssssss", $content, $type, $audience, $course, $layout, $imagesJson);
}

if ($stmt->execute()) {
    echo json_encode([
        'success' => true,
        'message' => 'Post saved successfully',
        'id' => $conn->insert_id,
        'debug' => [
            'has_images' => $hasImages,
            'images_count' => $imagesCount,
            'images_json_length' => $imagesJson ? strlen($imagesJson) : 0,
            'images_preview' => $imagesJson ? substr($imagesJson, 0, 100) : 'none'
        ]
    ]);
} else {
    echo json_encode([
        'success' => false, 
        'message' => 'Failed to save post: ' . $conn->error,
        'debug' => [
            'has_images' => $hasImages,
            'images_count' => $imagesCount,
            'images_json_length' => $imagesJson ? strlen($imagesJson) : 0
        ]
    ]);
}

$stmt->close();
$conn->close();
?>