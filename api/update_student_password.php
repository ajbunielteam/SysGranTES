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

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../php_errors.log');

// Clean any output buffer
if (ob_get_level()) {
    ob_end_clean();
}

// Set CORS headers for actual request
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

require_once '../config/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

error_log('Student password change request: ' . json_encode($data));
error_log('Full request data: ' . print_r($data, true));

$studentId = $data['studentId'] ?? 0;
$email = $data['email'] ?? '';
$student_id = $data['student_id'] ?? '';
$newPassword = $data['newPassword'] ?? '';

error_log("Extracted values - studentId: $studentId, email: $email, student_id: $student_id");

try {
    $conn = getDatabaseConnection();

    // Determine which identifier to use and prepare query
    $checkQuery = '';
    $updateQuery = '';
    $updateBindParam = '';
    $bindValue = null;
    $identifierType = '';
    
    if ($studentId > 0) {
        // Use ID if provided
        $checkQuery = "SELECT id FROM students WHERE id = ?";
        $checkBindType = "i";
        $updateQuery = "UPDATE students SET password = ? WHERE id = ?";
        $updateBindParam = "si";
        $bindValue = $studentId;
        $identifierType = "id ($studentId)";
    } elseif (!empty($email)) {
        // Use email if provided
        $checkQuery = "SELECT id, email, student_id FROM students WHERE email = ?";
        $checkBindType = "s";
        $updateQuery = "UPDATE students SET password = ? WHERE email = ?";
        $updateBindParam = "ss";
        $bindValue = $email;
        $identifierType = "email ($email)";
    } elseif (!empty($student_id)) {
        // Use student_id if provided
        $checkQuery = "SELECT id, email, student_id FROM students WHERE student_id = ?";
        $checkBindType = "s";
        $updateQuery = "UPDATE students SET password = ? WHERE student_id = ?";
        $updateBindParam = "ss";
        $bindValue = $student_id;
        $identifierType = "student_id ($student_id)";
    } else {
        echo json_encode(['success' => false, 'message' => 'Student identifier is required']);
        exit;
    }
    
    error_log("Checking student exists with $identifierType");
    
    // First check if student exists
    $checkStmt = $conn->prepare($checkQuery);
    $checkStmt->bind_param($checkBindType, $bindValue);
    $checkStmt->execute();
    $result = $checkStmt->get_result();
    
    if ($result->num_rows === 0) {
        error_log("No student found with $identifierType");
        
        // Debug: List all students in database
        $debugQuery = "SELECT id, email, student_id FROM students LIMIT 10";
        $debugResult = $conn->query($debugQuery);
        error_log("Students in database:");
        while ($row = $debugResult->fetch_assoc()) {
            error_log(json_encode($row));
        }
        
        echo json_encode(['success' => false, 'message' => "No student found with the provided identifier ($identifierType)"]);
        $checkStmt->close();
        $conn->close();
        exit;
    }
    
    $foundStudent = $result->fetch_assoc();
    error_log("Student found: " . json_encode($foundStudent));
    $checkStmt->close();
    
    // Now update the password
    $stmt = $conn->prepare($updateQuery);
    $stmt->bind_param($updateBindParam, $newPassword, $bindValue);

    if ($stmt->execute()) {
        $affectedRows = $conn->affected_rows;
        error_log('Student password updated successfully. Affected rows: ' . $affectedRows);
        
        // Success even if affected rows is 0 (password was already set to that value)
        echo json_encode(['success' => true, 'message' => 'Student password updated successfully']);
    } else {
        error_log('Failed to update password: ' . $conn->error);
        echo json_encode(['success' => false, 'message' => 'Failed to update password: ' . $conn->error]);
    }

    $stmt->close();
    $conn->close();
} catch (Exception $e) {
    error_log('Exception in update_student_password.php: ' . $e->getMessage());
    if (isset($conn)) $conn->close();
    echo json_encode([
        'success' => false,
        'message' => 'Error updating password: ' . $e->getMessage()
    ]);
}
?>