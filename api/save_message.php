<?php
// Disable error display and ensure JSON output
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../php_errors.log');

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

$senderId = $data['senderId'] ?? 0;
$receiverId = $data['receiverId'] ?? 0;
$senderType = $data['senderType'] ?? '';
$receiverType = $data['receiverType'] ?? '';
$content = $data['content'] ?? '';
$attachment = $data['attachment'] ?? null;
$attachmentName = $data['attachmentName'] ?? null;

try {
    $conn = getDatabaseConnection();
    
    // Check if messages table exists
    $tableCheck = $conn->query("SHOW TABLES LIKE 'messages'");
    if ($tableCheck->num_rows == 0) {
        $conn->close();
        echo json_encode([
            'success' => false,
            'message' => 'Messages table does not exist. Please run the SQL script to create it.'
        ]);
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO messages (sender_id, receiver_id, sender_type, receiver_type, content, attachment, attachment_name, read_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW())");
    $stmt->bind_param("iisssss", $senderId, $receiverId, $senderType, $receiverType, $content, $attachment, $attachmentName);

    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Message saved successfully',
            'id' => $conn->insert_id
        ]);
    } else {
        echo json_encode([
            'success' => false, 
            'message' => 'Failed to save message: ' . $conn->error,
            'stmt_error' => $stmt->error
        ]);
    }

    $stmt->close();
    $conn->close();
} catch (Exception $e) {
    if (isset($conn)) $conn->close();
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ]);
}
?>