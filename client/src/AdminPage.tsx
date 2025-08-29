import React, { useState } from 'react';

interface AdminPageProps {
    onBack: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ onBack }) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFile(event.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setMessage('Please select a file to upload.');
            return;
        }

        const initData = window.Telegram?.WebApp?.initData;

        if (!initData) {
            setMessage('Could not retrieve user authentication data.');
            return;
        }

        setUploading(true);
        setMessage('');
        const formData = new FormData();
        formData.append('lesson', file);
        formData.append('initData', initData);

        try {
            const response = await fetch('/api/upload-lesson', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message || 'Upload successful!');
                setFile(null);
            } else {
                setMessage(`Error: ${data.error || 'Upload failed.'}`);
            }
        } catch (error) {
            console.error('Upload error:', error);
            setMessage('An unexpected error occurred.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ padding: '20px', color: 'var(--text-color)', background: 'var(--background-color)', minHeight: '100vh', boxSizing: 'border-box' }}>
            <button onClick={onBack} style={{ marginBottom: '20px', padding: '8px 12px', cursor: 'pointer' }}>
                &larr; Back to App
            </button>
            <h1>Admin - Upload Lesson</h1>
            <p>Upload a .md file or a .zip archive containing the lesson and its images.</p>
            <div style={{ margin: '20px 0' }}>
                <input type="file" onChange={handleFileChange} accept=".md,.zip" />
            </div>
            {file && (
                <div style={{ margin: '10px 0' }}>
                    Selected file: {file.name}
                </div>
            )}
            <button onClick={handleUpload} disabled={!file || uploading} style={{ padding: '8px 12px', cursor: 'pointer' }}>
                {uploading ? 'Uploading...' : 'Upload'}
            </button>
            {message && (
                <div style={{ marginTop: '20px', padding: '10px', borderRadius: '5px', background: message.startsWith('Error') ? '#ffdddd' : '#ddffdd', color: message.startsWith('Error') ? '#d8000c' : '#4f8a10' }}>
                    {message}
                </div>
            )}
        </div>
    );
};

export default AdminPage;
