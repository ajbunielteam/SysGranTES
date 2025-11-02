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

try {
    $conn = getDatabaseConnection();
    
    // Get audience filter from query parameter
    $audience = isset($_GET['audience']) ? $_GET['audience'] : '';
    
    // Build query - check if created_at column exists
    $checkCol = $conn->query("SHOW COLUMNS FROM admin_posts LIKE 'created_at'");
    $hasCreatedAt = $checkCol && $checkCol->num_rows > 0;
    
    if (!empty($audience)) {
        if ($hasCreatedAt) {
            $stmt = $conn->prepare("SELECT id, content, type, audience, course, layout, author, images, likes, comments, timestamp, created_at 
                                    FROM admin_posts 
                                    WHERE audience = ? 
                                    ORDER BY COALESCE(created_at, timestamp) DESC");
        } else {
            $stmt = $conn->prepare("SELECT id, content, type, audience, course, layout, author, images, likes, comments, timestamp 
                                    FROM admin_posts 
                                    WHERE audience = ? 
                                    ORDER BY timestamp DESC");
        }
        $stmt->bind_param("s", $audience);
    } else {
        if ($hasCreatedAt) {
            $stmt = $conn->prepare("SELECT id, content, type, audience, course, layout, author, images, likes, comments, timestamp, created_at 
                                    FROM admin_posts 
                                    ORDER BY COALESCE(created_at, timestamp) DESC");
        } else {
            $stmt = $conn->prepare("SELECT id, content, type, audience, course, layout, author, images, likes, comments, timestamp 
                                    FROM admin_posts 
                                    ORDER BY timestamp DESC");
        }
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    
    $posts = [];
    
    while ($row = $result->fetch_assoc()) {
        // Parse images if it's a JSON string
        $images = null;
        if (!empty($row['images'])) {
            // Try to decode as JSON first
            $decoded = json_decode($row['images'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                // Valid JSON
                if (is_array($decoded)) {
                    $images = $decoded;
                } else {
                    $images = $decoded ? [$decoded] : [];
                }
            } else {
                // Not valid JSON, treat as single image string
                $images = [$row['images']];
            }
        } else {
            $images = [];
        }
        
        // Parse comments from JSON
        $comments = [];
        $comments_count = 0;
        if (isset($row['comments']) && !empty($row['comments'])) {
            if (is_string($row['comments'])) {
                // Try to decode as JSON
                $comments_data = json_decode($row['comments'], true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($comments_data)) {
                    // Valid JSON array - use it as comments
                    $comments = $comments_data;
                    $comments_count = count($comments_data);
                } else if (is_numeric($row['comments'])) {
                    // If it's numeric, treat as count only
                    $comments_count = (int)$row['comments'];
                    $comments = [];
                } else if ($row['comments'] === '[]' || $row['comments'] === '') {
                    $comments = [];
                    $comments_count = 0;
                }
            } else if (is_numeric($row['comments'])) {
                $comments_count = (int)$row['comments'];
                $comments = [];
            }
        }
        
        // Use created_at if available, otherwise use timestamp
        $created_at = isset($row['created_at']) && !empty($row['created_at']) 
            ? $row['created_at'] 
            : (isset($row['timestamp']) && !empty($row['timestamp']) 
                ? $row['timestamp'] 
                : date('Y-m-d H:i:s'));
        
        $post = [
            'id' => (int)$row['id'],
            'content' => $row['content'] ?? '',
            'type' => $row['type'] ?? 'text',
            'audience' => $row['audience'] ?? '',
            'course' => $row['course'],
            'layout' => $row['layout'] ?? 'image-left',
            'author' => $row['author'] ?? 'Administrator',
            'images' => $images,
            'likes' => (int)($row['likes'] ?? 0),
            'comments' => $comments, // Include full comments array
            'comments_count' => $comments_count,
            'created_at' => $created_at,
            'timestamp' => $created_at
        ];
        
        $posts[] = $post;
    }
    
    $stmt->close();
    $conn->close();
    
    echo json_encode([
        'success' => true,
        'posts' => $posts,
        'count' => count($posts)
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
    
    if (isset($conn)) {
        $conn->close();
    }
}
?>
