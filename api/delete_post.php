<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$postId = $data['postId'] ?? null;

if (!$postId) {
    echo json_encode(['success' => false, 'message' => 'Missing post ID']);
    exit;
}

$conn = getDatabaseConnection();

try {
    // Check if post exists
    $checkStmt = $conn->prepare("SELECT id FROM admin_posts WHERE id = ?");
    $checkStmt->bind_param("i", $postId);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['success' => false, 'message' => 'Post not found']);
        $checkStmt->close();
        $conn->close();
        exit;
    }
    
    // Delete the post
    $deleteStmt = $conn->prepare("DELETE FROM admin_posts WHERE id = ?");
    $deleteStmt->bind_param("i", $postId);
    
    if ($deleteStmt->execute()) {
        echo json_encode(['success' => true, 'message' => 'Post deleted successfully']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Failed to delete post']);
    }
    
    $deleteStmt->close();
    $checkStmt->close();
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'Error: ' . $e->getMessage()]);
}

$conn->close();
?>
