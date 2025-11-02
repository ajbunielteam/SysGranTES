<?php
// Disable error display and ensure JSON output
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../php_errors.log');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
require_once '../config/database.php';

try {
    $userId = intval($_GET['userId'] ?? 0);
    $userType = $_GET['userType'] ?? '';
    $receiverId = intval($_GET['receiverId'] ?? 0);
    $receiverType = $_GET['receiverType'] ?? '';

    $conn = getDatabaseConnection();

    // Check if messages table exists
    try {
        $tableCheck = $conn->query("SHOW TABLES LIKE 'messages'");
        if (!$tableCheck || $tableCheck->num_rows == 0) {
            $conn->close();
            echo json_encode(['success' => true, 'messages' => []]);
            exit;
        }
    } catch (Exception $e) {
        $conn->close();
        echo json_encode(['success' => true, 'messages' => []]);
        exit;
    }

    $messages = [];
    
    // Get conversation between two users
    if ($receiverId > 0 && $receiverType) {
        try {
            $stmt = $conn->prepare("SELECT * FROM messages WHERE 
                ((sender_id = ? AND receiver_id = ? AND sender_type = ? AND receiver_type = ?) OR
                 (sender_id = ? AND receiver_id = ? AND sender_type = ? AND receiver_type = ?))
                ORDER BY created_at ASC");
            // Parameters: userId, receiverId, userType, receiverType, receiverId, userId, receiverType, userType
            $stmt->bind_param("iissiiss", $userId, $receiverId, $userType, $receiverType, 
                                            $receiverId, $userId, $receiverType, $userType);
            $stmt->execute();
            $result = $stmt->get_result();
            
            while ($row = $result->fetch_assoc()) {
                $messages[] = [
                    'id' => $row['id'],
                    'senderId' => $row['sender_id'],
                    'receiverId' => $row['receiver_id'],
                    'senderType' => $row['sender_type'],
                    'receiverType' => $row['receiver_type'],
                    'content' => $row['content'],
                    'attachment' => $row['attachment'],
                    'attachmentName' => $row['attachment_name'],
                    'readStatus' => (bool)$row['read_status'],
                    'createdAt' => $row['created_at']
                ];
            }
            $stmt->close();
        } catch (Exception $e) {
            error_log("Error fetching messages: " . $e->getMessage());
        }
    } else if ($userId > 0 && $userType) {
        // Get all messages for a user
        try {
            $stmt = $conn->prepare("SELECT * FROM messages WHERE (sender_id = ? AND sender_type = ?) OR (receiver_id = ? AND receiver_type = ?) ORDER BY created_at ASC");
            $stmt->bind_param("isis", $userId, $userType, $userId, $userType);
            $stmt->execute();
            $result = $stmt->get_result();
            
            while ($row = $result->fetch_assoc()) {
                $messages[] = [
                    'id' => $row['id'],
                    'senderId' => $row['sender_id'],
                    'receiverId' => $row['receiver_id'],
                    'senderType' => $row['sender_type'],
                    'receiverType' => $row['receiver_type'],
                    'content' => $row['content'],
                    'attachment' => $row['attachment'],
                    'attachmentName' => $row['attachment_name'],
                    'readStatus' => (bool)$row['read_status'],
                    'createdAt' => $row['created_at']
                ];
            }
            $stmt->close();
        } catch (Exception $e) {
            error_log("Error fetching messages: " . $e->getMessage());
        }
    }

    $conn->close();
    echo json_encode(['success' => true, 'messages' => $messages]);
    
} catch (Exception $e) {
    if (isset($conn) && $conn) $conn->close();
    echo json_encode([
        'success' => false,
        'message' => 'Error fetching messages: ' . $e->getMessage(),
        'messages' => []
    ]);
}
?>