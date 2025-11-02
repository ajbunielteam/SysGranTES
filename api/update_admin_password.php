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

$currentPassword = $data['currentPassword'] ?? '';
$newPassword = $data['newPassword'] ?? '';
$email = $data['email'] ?? 'admin@grantes.com';

$conn = getDatabaseConnection();

// Verify current password
$stmt = $conn->prepare("SELECT password FROM admin_credentials WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Admin not found']);
    exit;
}

$admin = $result->fetch_assoc();

if ($currentPassword !== $admin['password']) {
    echo json_encode(['success' => false, 'message' => 'Current password is incorrect']);
    $stmt->close();
    $conn->close();
    exit;
}

$stmt->close();

// Update password
$stmt = $conn->prepare("UPDATE admin_credentials SET password = ? WHERE email = ?");
$stmt->bind_param("ss", $newPassword, $email);

if ($stmt->execute()) {
    echo json_encode(['success' => true, 'message' => 'Password updated successfully']);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to update password: ' . $conn->error]);
}

$stmt->close();
$conn->close();
?>