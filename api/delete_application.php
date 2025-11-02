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

// Handle both JSON and FormData requests
$isFormData = isset($_SERVER['CONTENT_TYPE']) && strpos($_SERVER['CONTENT_TYPE'], 'multipart/form-data') !== false;

if ($isFormData) {
    $appId = $_POST['id'] ?? '';
} else {
    $data = json_decode(file_get_contents('php://input'), true);
    $appId = $data['id'] ?? '';
}

if (empty($appId)) {
    echo json_encode(['success' => false, 'message' => 'Application ID is required']);
    exit;
}

$conn = getDatabaseConnection();

// Check if applications table exists
$tableCheck = $conn->query("SHOW TABLES LIKE 'applications'");
if ($tableCheck->num_rows == 0) {
    echo json_encode([
        'success' => false,
        'message' => 'Applications table does not exist'
    ]);
    $conn->close();
    exit;
}

// Delete the application
$stmt = $conn->prepare("DELETE FROM applications WHERE id = ?");
$stmt->bind_param("i", $appId);

if ($stmt->execute()) {
    $affectedRows = $stmt->affected_rows;
    if ($affectedRows > 0) {
        echo json_encode([
            'success' => true,
            'message' => 'Application deleted successfully'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Application not found or already deleted'
        ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'message' => 'Failed to delete application: ' . $stmt->error
    ]);
}

$stmt->close();
$conn->close();
?>

