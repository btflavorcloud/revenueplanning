'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Clock, Tag } from 'lucide-react';

interface Version {
  id: string;
  version_name: string | null;
  is_auto_snapshot: boolean;
  created_at: string;
}

interface VersionHistoryModalProps {
  scenarioId: string;
  isOpen: boolean;
  onClose: () => void;
  onRestore: (versionId: string) => Promise<void>;
  onDelete: (versionId: string) => Promise<void>;
  fetchVersions: (scenarioId: string) => Promise<Version[]>;
}

export default function VersionHistoryModal({
  scenarioId,
  isOpen,
  onClose,
  onRestore,
  onDelete,
  fetchVersions,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && scenarioId) {
      setLoading(true);
      fetchVersions(scenarioId)
        .then(data => {
          setVersions(data);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [isOpen, scenarioId, fetchVersions]);

  const handleRestore = async (versionId: string) => {
    if (!confirm('Restore this version? Current state will be replaced.')) return;

    setActionLoading(versionId);
    try {
      await onRestore(versionId);
      onClose();
    } catch (error) {
      alert('Failed to restore version');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (versionId: string) => {
    if (!confirm('Delete this version? This cannot be undone.')) return;

    setActionLoading(versionId);
    try {
      await onDelete(versionId);
      // Refresh version list
      const data = await fetchVersions(scenarioId);
      setVersions(data);
    } catch (error) {
      alert('Failed to delete version');
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Version History</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Version List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
              <p className="text-gray-600">Loading versions...</p>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">No version history yet</p>
              <p className="text-sm text-gray-400 mt-2">
                Versions will be created daily and when you manually save
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map(version => (
                <div
                  key={version.id}
                  className="border border-gray-300 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {version.is_auto_snapshot ? (
                          <Clock className="w-4 h-4 text-gray-400" />
                        ) : (
                          <Tag className="w-4 h-4 text-blue-600" />
                        )}
                        <p className="font-semibold text-gray-900">
                          {version.version_name || (
                            <span className="text-gray-500 italic">
                              Auto-snapshot
                            </span>
                          )}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(version.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRestore(version.id)}
                        disabled={actionLoading === version.id}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                      >
                        {actionLoading === version.id ? 'Restoring...' : 'Restore'}
                      </button>
                      {!version.is_auto_snapshot && (
                        <button
                          onClick={() => handleDelete(version.id)}
                          disabled={actionLoading === version.id}
                          className="px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-600">
            <span className="font-semibold">Showing last {versions.length} version{versions.length !== 1 ? 's' : ''}</span>
            {' • '}
            Auto-snapshots created daily • Manual versions kept indefinitely
          </p>
        </div>
      </div>
    </div>
  );
}
