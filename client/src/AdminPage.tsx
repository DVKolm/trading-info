import React, { useState, useEffect } from 'react';
import { Upload, Trash2, ArrowLeft, File, Folder, AlertTriangle } from 'lucide-react';
import { LessonStructure } from './types';

interface AdminPageProps {
    onBack: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ onBack }) => {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const [lessonStructure, setLessonStructure] = useState<LessonStructure[]>([]);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'upload' | 'manage'>('upload');

    useEffect(() => {
        if (activeTab === 'manage') {
            fetchLessonStructure();
        }
    }, [activeTab]);

    const fetchLessonStructure = async () => {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || '';
            const response = await fetch(`${apiUrl}/api/lessons/structure`);
            const data = await response.json();
            setLessonStructure(data.structure);
        } catch (error) {
            console.error('Error fetching lessons:', error);
            setMessage('Error loading lessons structure.');
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFile(event.target.files[0]);
            setMessage(''); // Clear previous messages
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
                // Clear the file input
                const fileInput = document.getElementById('file-input') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
                // Refresh lesson structure if on manage tab
                if (activeTab === 'manage') {
                    fetchLessonStructure();
                }
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

    const handleDelete = async (lessonPath: string) => {
        const initData = window.Telegram?.WebApp?.initData;

        if (!initData) {
            setMessage('Could not retrieve user authentication data.');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete: ${lessonPath}?`)) {
            return;
        }

        setDeleting(lessonPath);
        setMessage('');

        try {
            const response = await fetch('/api/delete-lesson', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    initData,
                    lessonPath
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message || 'Delete successful!');
                fetchLessonStructure(); // Refresh the list
            } else {
                setMessage(`Error: ${data.error || 'Delete failed.'}`);
            }
        } catch (error) {
            console.error('Delete error:', error);
            setMessage('An unexpected error occurred.');
        } finally {
            setDeleting(null);
        }
    };

    const renderFileTree = (items: LessonStructure[], level = 0) => {
        return items.map((item) => (
            <div key={item.id} className="file-tree-item" style={{ marginLeft: `${level * 20}px` }}>
                <div className="file-item-content">
                    <div className="file-item-info">
                        {item.type === 'folder' ? (
                            <Folder size={16} className="file-icon folder" />
                        ) : (
                            <File size={16} className="file-icon file" />
                        )}
                        <span className="file-name">{item.name}</span>
                    </div>
                    <button
                        onClick={() => handleDelete(item.path)}
                        disabled={deleting === item.path}
                        className="delete-btn"
                        title={`Delete ${item.type === 'folder' ? 'folder' : 'file'}`}
                    >
                        {deleting === item.path ? (
                            <div className="loading-spinner" />
                        ) : (
                            <Trash2 size={14} />
                        )}
                    </button>
                </div>
                {item.children && item.children.length > 0 && (
                    <div className="file-children">
                        {renderFileTree(item.children, level + 1)}
                    </div>
                )}
            </div>
        ));
    };

    return (
        <div className="admin-page">
            <div className="admin-header">
                <button onClick={onBack} className="back-btn">
                    <ArrowLeft size={18} />
                    Back to App
                </button>
                <h1>Admin Panel</h1>
            </div>

            <div className="admin-tabs">
                <button
                    onClick={() => setActiveTab('upload')}
                    className={`tab-btn ${activeTab === 'upload' ? 'active' : ''}`}
                >
                    <Upload size={18} />
                    Upload Lessons
                </button>
                <button
                    onClick={() => setActiveTab('manage')}
                    className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
                >
                    <Folder size={18} />
                    Manage Files
                </button>
            </div>

            <div className="admin-content">
                {activeTab === 'upload' && (
                    <div className="upload-section">
                        <div className="upload-card">
                            <div className="upload-header">
                                <Upload size={24} />
                                <div>
                                    <h2>Upload Lesson</h2>
                                    <p>Upload .md files or .zip archives to "Средний уровень (Подписка)" folder</p>
                                </div>
                            </div>

                            <div className="file-input-container">
                                <input 
                                    id="file-input"
                                    type="file" 
                                    onChange={handleFileChange} 
                                    accept=".md,.zip"
                                    className="file-input" 
                                />
                                <label htmlFor="file-input" className="file-input-label">
                                    <Upload size={20} />
                                    Choose File
                                </label>
                            </div>

                            {file && (
                                <div className="selected-file">
                                    <File size={16} />
                                    <span>{file.name}</span>
                                    <button onClick={() => {
                                        setFile(null);
                                        const fileInput = document.getElementById('file-input') as HTMLInputElement;
                                        if (fileInput) fileInput.value = '';
                                    }} className="remove-file-btn">×</button>
                                </div>
                            )}

                            <button 
                                onClick={handleUpload} 
                                disabled={!file || uploading} 
                                className="upload-btn"
                            >
                                {uploading ? (
                                    <>
                                        <div className="loading-spinner" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <Upload size={18} />
                                        Upload Lesson
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'manage' && (
                    <div className="manage-section">
                        <div className="manage-card">
                            <div className="manage-header">
                                <Folder size={24} />
                                <div>
                                    <h2>Manage Files</h2>
                                    <p>View and delete lesson files and folders</p>
                                </div>
                            </div>

                            {lessonStructure.length > 0 ? (
                                <div className="file-tree">
                                    {renderFileTree(lessonStructure)}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <Folder size={48} />
                                    <p>No lessons found</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {message && (
                    <div className={`message ${message.startsWith('Error') ? 'error' : 'success'}`}>
                        {message.startsWith('Error') ? (
                            <AlertTriangle size={18} />
                        ) : (
                            <Upload size={18} />
                        )}
                        {message}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPage;
