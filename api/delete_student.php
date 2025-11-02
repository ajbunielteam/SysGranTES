<?php
// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Access-Control-Max-Age: 3600');
    http_response_code(200);
    exit();
}

// Disable error display and ensure JSON output
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../php_errors.log');

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

$studentId = intval($data['id'] ?? $data['studentId'] ?? 0);

if ($studentId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid student ID']);
    exit;
}

try {
    $conn = getDatabaseConnection();

    // Delete related records first (cascade delete)
    // Delete messages associated with this student
    try {
        $stmt1 = $conn->prepare("DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?");
        if ($stmt1) {
            $stmt1->bind_param("ii", $studentId, $studentId);
            $stmt1->execute();
            $stmt1->close();
        }
    } catch (Exception $e) {
        // Log but don't fail if messages table doesn't exist or has issues
        error_log("Warning: Could not delete messages for student $studentId: " . $e->getMessage());
    }

    // Delete notifications associated with this student (optional - table may not exist)
    try {
        // Check if notifications table exists first
        $tableCheck = $conn->query("SHOW TABLES LIKE 'notifications'");
        if ($tableCheck && $tableCheck->num_rows > 0) {
            $stmt2 = $conn->prepare("DELETE FROM notifications WHERE user_id = ? AND user_type = 'student'");
            if ($stmt2) {
                $stmt2->bind_param("i", $studentId);
                $stmt2->execute();
                $stmt2->close();
            }
        }
    } catch (Exception $e) {
        // Ignore errors if notifications table doesn't exist
        error_log("Warning: Could not delete notifications for student $studentId: " . $e->getMessage());
    }

    // Delete the student
    $stmt = $conn->prepare("DELETE FROM students WHERE id = ?");
    $stmt->bind_param("i", $studentId);

    if ($stmt->execute()) {
        $affectedRows = $stmt->affected_rows;
        if ($affectedRows > 0) {
            echo json_encode([
                'success' => true,
                'message' => 'Student deleted successfully'
            ]);
        } else {
            echo json_encode([
                'success' => false,
                'message' => 'Student not found or already deleted'
            ]);
        }
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to delete student: ' . $conn->error
        ]);
    }

    $stmt->close();
    $conn->close();
} catch (Exception $e) {
    if (isset($conn)) $conn->close();
    echo json_encode([
        'success' => false,
        'message' => 'Error deleting student: ' . $e->getMessage()
    ]);
}
?>

