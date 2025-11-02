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

try {
    require_once '../config/database.php';
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Database config error: ' . $e->getMessage()]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

$postId = $data['postId'] ?? null;
$action = $data['action'] ?? null; // 'like', 'comment', 'share'

if (!$postId || !$action) {
    echo json_encode(['success' => false, 'message' => 'Missing required parameters']);
    exit;
}

$conn = getDatabaseConnection();

try {
    // Get current values
    $stmt = $conn->prepare("SELECT likes, comments FROM admin_posts WHERE id = ?");
    $stmt->bind_param("i", $postId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Post not found', 'postId' => $postId]);
        $stmt->close();
        $conn->close();
        exit;
    }
    
    $row = $result->fetch_assoc();
    $currentLikes = isset($row['likes']) ? (int)$row['likes'] : 0;
    
    // Get shares count separately (in case column doesn't exist yet)
    $sharesCheck = $conn->query("SHOW COLUMNS FROM admin_posts LIKE 'shares'");
    $hasShares = $sharesCheck && $sharesCheck->num_rows > 0;
    $currentShares = 0;
    
    // Update based on action
    if ($action === 'like') {
        // Increment like
        $newLikes = $currentLikes + 1;
        $updateStmt = $conn->prepare("UPDATE admin_posts SET likes = ? WHERE id = ?");
        $updateStmt->bind_param("ii", $newLikes, $postId);
        $updateStmt->execute();
        $updateStmt->close();
        
        echo json_encode([
            'success' => true,
            'message' => 'Like added',
            'likes' => $newLikes,
            'liked' => true
        ]);
    } elseif ($action === 'unlike') {
        // Decrement like (ensure it doesn't go below 0)
        $newLikes = max(0, $currentLikes - 1);
        $updateStmt = $conn->prepare("UPDATE admin_posts SET likes = ? WHERE id = ?");
        $updateStmt->bind_param("ii", $newLikes, $postId);
        $updateStmt->execute();
        $updateStmt->close();
        
        echo json_encode([
            'success' => true,
            'message' => 'Like removed',
            'likes' => $newLikes,
            'liked' => false
        ]);
    } elseif ($action === 'share') {
        // Check if shares column exists before updating
        if ($hasShares) {
            $sharesResult = $conn->query("SELECT shares FROM admin_posts WHERE id = " . intval($postId));
            if ($sharesResult && $sharesResult->num_rows > 0) {
                $sharesRow = $sharesResult->fetch_assoc();
                $currentShares = isset($sharesRow['shares']) ? (int)$sharesRow['shares'] : 0;
            }
            
            $newShares = $currentShares + 1;
            $updateStmt = $conn->prepare("UPDATE admin_posts SET shares = ? WHERE id = ?");
            $updateStmt->bind_param("ii", $newShares, $postId);
            $updateStmt->execute();
            $updateStmt->close();
            
            echo json_encode([
                'success' => true,
                'message' => 'Share recorded',
                'shares' => $newShares
            ]);
        } else {
            // Shares column doesn't exist, just return success without updating
            echo json_encode([
                'success' => true,
                'message' => 'Share recorded (column not added yet)',
                'shares' => 0
            ]);
        }
    } elseif ($action === 'comment') {
        // For comments, we need to get current comments and add the new one
        $commentStmt = $conn->prepare("SELECT comments FROM admin_posts WHERE id = ?");
        $commentStmt->bind_param("i", $postId);
        $commentStmt->execute();
        $commentResult = $commentStmt->get_result();
        
        if ($commentResult->num_rows > 0) {
            $postRow = $commentResult->fetch_assoc();
            $commentsJson = $postRow['comments'] ?? '[]';
            $comments = json_decode($commentsJson, true);
            
            if (!is_array($comments)) {
                $comments = [];
            }
            
            // Add new comment with proper timestamp
            $newComment = [
                'id' => time() . rand(1000, 9999), // Unique ID
                'author' => $data['author'] ?? 'User',
                'content' => $data['comment'] ?? '',
                'text' => $data['comment'] ?? '', // Also include as 'text' for compatibility
                'timestamp' => date('Y-m-d H:i:s'),
                'created_at' => date('Y-m-d H:i:s') // Also include created_at for compatibility
            ];
            
            $comments[] = $newComment;
            
            $commentsJson = json_encode($comments);
            $updateStmt = $conn->prepare("UPDATE admin_posts SET comments = ? WHERE id = ?");
            $updateStmt->bind_param("si", $commentsJson, $postId);
            $updateStmt->execute();
            $updateStmt->close();
            
            echo json_encode([
                'success' => true,
                'message' => 'Comment added',
                'comments_count' => count($comments),
                'comment' => $newComment // Return the new comment so frontend can display it immediately
            ]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Post not found']);
        }
        
        $commentStmt->close();
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid action']);
    }
    
    $stmt->close();
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
}

$conn->close();
?>

