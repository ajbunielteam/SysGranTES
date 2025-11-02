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

$studentId = intval($data['id'] ?? 0);
$firstName = $data['firstName'] ?? '';
$lastName = $data['lastName'] ?? '';
$email = $data['email'] ?? '';
$course = $data['course'] ?? '';
$year = $data['year'] ?? '';
$department = $data['department'] ?? '';
$place = $data['place'] ?? '';
$isIndigenous = isset($data['isIndigenous']) ? intval($data['isIndigenous']) : 0;
$isPwd = isset($data['isPwd']) ? intval($data['isPwd']) : 0;

try {
    $conn = getDatabaseConnection();

    // Use year_level column name to match database schema
    $stmt = $conn->prepare("UPDATE students SET 
        first_name = ?, 
        last_name = ?, 
        email = ?, 
        course = ?, 
        year_level = ?, 
        department = ?, 
        place = ?, 
        is_indigenous = ?, 
        is_pwd = ? 
        WHERE id = ?");

    $stmt->bind_param("sssssssiii", $firstName, $lastName, $email, $course, $year, $department, $place, $isIndigenous, $isPwd, $studentId);

    if ($stmt->execute()) {
        echo json_encode([
            'success' => true,
            'message' => 'Student updated successfully'
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'message' => 'Failed to update student: ' . $conn->error
        ]);
    }

    $stmt->close();
    $conn->close();
} catch (Exception $e) {
    if (isset($conn)) $conn->close();
    echo json_encode([
        'success' => false,
        'message' => 'Error updating student: ' . $e->getMessage()
    ]);
}
?>

