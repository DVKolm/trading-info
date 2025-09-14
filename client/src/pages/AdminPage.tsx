import React, { useState, useEffect } from 'react';
import { Upload, Trash2, ArrowLeft, File, Folder, AlertTriangle } from 'lucide-react';
import { LessonStructure } from '../types';

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
    const [folders, setFolders] = useState<{name: string, path: string}[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string>('');

    useEffect(() => {
        fetchFolders(); // Always fetch folders on mount
        if (activeTab === 'manage') {
            fetchLessonStructure();
        }
    }, [activeTab]);

    const fetchFolders = async () => {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || '';
            const response = await fetch(`${apiUrl}/api/lessons/folders`);
            const data = await response.json();
            setFolders(data.folders);
            // Set default folder to 'Средний уровень (Подписка)' if available
            const defaultFolder = data.folders.find((f: any) => f.name.includes('Средний уровень'));
            if (defaultFolder) {
                setSelectedFolder(defaultFolder.path);
            }
        } catch (error) {
            console.error('Error fetching folders:', error);
        }
    };

    const fetchLessonStructure = async () => {
        try {
            const apiUrl = process.env.REACT_APP_API_URL || '';
            const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '0';
            const response = await fetch(`${apiUrl}/api/upload/file-tree`, {
                headers: {
                    'X-Telegram-User-Id': telegramId
                }
            });
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
        if (selectedFolder) {
            formData.append('targetFolder', selectedFolder);
        }

        try {
            const apiUrl = process.env.REACT_APP_API_URL || '';
            const response = await fetch(`${apiUrl}/api/upload/lesson`, {
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

                // Always refresh lesson structure after successful upload
                await fetchLessonStructure();

                // Switch to manage tab to show the uploaded lesson
                setActiveTab('manage');

                // Reload the page after a short delay to ensure all caches are cleared
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
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

    const handleDelete = async (lessonPath: string, itemType?: 'folder' | 'file') => {
        console.log('🔍 Delete requested for path:', lessonPath, 'type:', itemType);

        const initData = window.Telegram?.WebApp?.initData;
        console.log('📱 Telegram initData:', initData);

        if (!initData) {
            setMessage('Could not retrieve user authentication data.');
            console.error('❌ No initData available');
            return;
        }

        // Find the item in the lesson structure to determine its type
        const findItemType = (items: LessonStructure[], path: string): 'folder' | 'file' => {
            for (const item of items) {
                if (item.path === path) {
                    return item.type;
                }
                if (item.children) {
                    const foundType = findItemType(item.children, path);
                    if (foundType) return foundType;
                }
            }
            return 'file'; // default to file if not found
        };

        const deleteType = itemType || findItemType(lessonStructure, lessonPath);
        const itemName = deleteType === 'folder' ? 'folder' : 'lesson';

        console.log('🎯 Delete type determined:', deleteType, 'for item:', itemName);

        if (!window.confirm(`Are you sure you want to delete this ${itemName}: ${lessonPath}?`)) {
            console.log('❌ User cancelled deletion');
            return;
        }

        console.log('✅ User confirmed deletion, proceeding...');
        setDeleting(lessonPath);
        setMessage('');

        try {
            const apiUrl = process.env.REACT_APP_API_URL || '';
            let response: Response;
            console.log('🌐 API URL:', apiUrl);

            if (deleteType === 'folder') {
                // Delete folder using folder deletion endpoint
                const url = `${apiUrl}/api/upload/lessons/${encodeURIComponent(lessonPath)}`;
                console.log('📂 Deleting folder with URL:', url);
                console.log('🔑 Using Telegram User ID:', window.Telegram?.WebApp?.initDataUnsafe?.user?.id);

                response = await fetch(url, {
                    method: 'DELETE',
                    headers: {
                        'X-Telegram-User-Id': window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || '0',
                    },
                });
            } else {
                // Delete individual lesson using lesson deletion endpoint
                const url = `${apiUrl}/api/upload/lesson`;
                const payload = {
                    initData,
                    lessonPath
                };
                console.log('📄 Deleting file with URL:', url);
                console.log('📦 Request payload:', payload);

                response = await fetch(url, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                });
            }

            console.log('📡 Response status:', response.status);
            console.log('📡 Response ok:', response.ok);

            const data = await response.json();

            if (response.ok) {
                setMessage(data.message || `${itemName.charAt(0).toUpperCase() + itemName.slice(1)} deleted successfully!`);
                // Refresh the lesson structure immediately
                await fetchLessonStructure();

                // Force reload to ensure all caches are cleared
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                setMessage(`Error: ${data.error || `${itemName.charAt(0).toUpperCase() + itemName.slice(1)} deletion failed.`}`);
            }
        } catch (error) {
            console.error('❌ Delete error:', error);
            console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error');
            setMessage('An unexpected error occurred: ' + (error instanceof Error ? error.message : 'Unknown error'));
        } finally {
            console.log('🏁 Delete operation finished, clearing deleting state');
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
                        onClick={() => handleDelete(item.path, item.type)}
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
                                    <p>Upload .md files or .zip archives to selected lesson folder</p>
                                </div>
                            </div>

                            <div className="folder-selection-container">
                                <label htmlFor="folder-select" className="folder-select-label">
                                    Target Folder:
                                </label>
                                <select 
                                    id="folder-select"
                                    value={selectedFolder} 
                                    onChange={(e) => setSelectedFolder(e.target.value)}
                                    className="folder-select"
                                >
                                    <option value="">-- Select Folder --</option>
                                    {folders.map((folder) => (
                                        <option key={folder.path} value={folder.path}>
                                            {folder.name}
                                        </option>
                                    ))}
                                </select>
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

                            <div className="manage-actions">
                                <button
                                    onClick={async () => {
                                        const initData = window.Telegram?.WebApp?.initData;
                                        if (!initData) {
                                            setMessage('Error: Authentication required');
                                            return;
                                        }

                                        try {
                                            const apiUrl = process.env.REACT_APP_API_URL || '';
                                            const response = await fetch(`${apiUrl}/api/upload/clear-cache`, {
                                                method: 'POST',
                                                headers: {
                                                    'Content-Type': 'application/json',
                                                },
                                                body: JSON.stringify({ initData }),
                                            });

                                            const data = await response.json();
                                            setMessage(data.message || 'Cache cleared');
                                            setTimeout(() => window.location.reload(), 1000);
                                        } catch (error) {
                                            setMessage('Error: Failed to clear cache');
                                        }
                                    }}
                                    className="clear-cache-btn"
                                    style={{ marginBottom: '1rem' }}
                                >
                                    🗑️ Clear All Cache
                                </button>
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
