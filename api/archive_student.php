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
$status = isset($data['status']) ? $data['status'] : 'archived';

if ($studentId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid student ID']);
    exit;
}

try {
    $conn = getDatabaseConnection();

    // Update student status
    $stmt = $conn->prepare("UPDATE students SET status = ? WHERE id = ?");
    $stmt->bind_param("si", $status, $studentId);

    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Student ' . ($status === 'archived' ? 'archived' : 'restored') . ' successfully'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to update student status: ' . $conn->error
        ]);
    }

    $stmt->close();
    $conn->close();
} catch (Exception $e) {
    if (isset($conn)) $conn->close();
    echo json_encode([
        'success' => false,
        'message' => 'Error updating student status: ' . $e->getMessage()
    ]);
}
?>

