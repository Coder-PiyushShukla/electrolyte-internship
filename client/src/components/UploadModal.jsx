import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiX, FiFile, FiCheck, FiAlertCircle, FiDownload, FiChevronDown } from 'react-icons/fi';
import api from '../utils/api';
import toast from 'react-hot-toast';

export default function UploadModal({ isOpen, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateBrand, setTemplateBrand] = useState('Bajaj');
  const [templateType, setTemplateType] = useState('inward');
  const [result, setResult] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    setTemplateLoading(true);
    try {
      const response = await api.get('/upload/template', {
        params: { brand: templateBrand, type: templateType },
        responseType: 'blob',
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const fileName = `${templateBrand}_${templateType === 'outward' ? 'Outward' : 'Inward'}_Pivoted_Template.xlsx`;
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Format file downloaded.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to download format file.');
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
      toast.success(data.message);
      onUploaded();
    } catch (err) {
      const errData = err.response?.data;
      toast.error(errData?.error || 'Upload failed.');
      if (errData?.parseErrors) {
        setResult({ error: true, parseErrors: errData.parseErrors });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="animate-scale-in relative bg-surface-900 border border-surface-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-800">
          <h2 className="text-lg font-semibold text-white">Import from Excel</h2>
          <button onClick={handleClose} className="p-2 text-surface-400 hover:text-white hover:bg-surface-800 rounded-lg transition-all cursor-pointer">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Format Download */}
          <div className="p-4 bg-surface-800/30 rounded-xl border border-surface-700/50 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">Brand</label>
                <div className="relative">
                  <select
                    value={templateBrand}
                    onChange={(e) => setTemplateBrand(e.target.value)}
                    className="appearance-none w-full bg-surface-800/60 border border-surface-700 text-white rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                  >
                    <option value="Bajaj">Bajaj</option>
                    <option value="Atomberg">Atomberg</option>
                  </select>
                  <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-400 mb-1.5">Type</label>
                <div className="relative">
                  <select
                    value={templateType}
                    onChange={(e) => setTemplateType(e.target.value)}
                    className="appearance-none w-full bg-surface-800/60 border border-surface-700 text-white rounded-xl px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                  >
                    <option value="inward">Inward</option>
                    <option value="outward">Outward</option>
                  </select>
                  <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-surface-500 pointer-events-none" />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              disabled={templateLoading}
              className="w-full py-2.5 px-4 bg-surface-800/80 border border-surface-700 text-surface-200 font-medium rounded-xl hover:bg-surface-700 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {templateLoading ? (
                <div className="w-4 h-4 border-2 border-surface-500 border-t-white rounded-full animate-spin" />
              ) : (
                <FiDownload className="w-4 h-4" />
              )}
              {templateLoading ? 'Preparing...' : 'Download Format'}
            </button>
          </div>

          {/* Dropzone */}
          <div
            {...getRootProps()}
            id="file-dropzone"
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
              ${isDragActive
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-surface-700 hover:border-surface-600 hover:bg-surface-800/30'
              }`}
          >
            <input {...getInputProps()} />
            <FiUploadCloud className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? 'text-brand-400' : 'text-surface-500'}`} />
            {isDragActive ? (
              <p className="text-brand-300 font-medium">Drop the file here...</p>
            ) : (
              <>
                <p className="text-surface-300 font-medium">Drag & drop your file here</p>
                <p className="text-xs text-surface-500 mt-1">or click to browse (.xlsx or .csv, max 10MB)</p>
              </>
            )}
          </div>

          {/* Selected File */}
          {file && (
            <div className="flex items-center gap-3 p-3 bg-surface-800/60 rounded-lg border border-surface-700">
              <FiFile className="w-5 h-5 text-brand-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white font-medium truncate">{file.name}</p>
                <p className="text-xs text-surface-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => { setFile(null); setResult(null); }} className="p-1 text-surface-500 hover:text-red-400 cursor-pointer">
                <FiX className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Result */}
          {result && !result.error && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <div className="flex items-center gap-2 text-emerald-400 font-medium text-sm mb-1">
                <FiCheck className="w-4 h-4" />
                Import Successful
              </div>
              <p className="text-xs text-emerald-300/80">
                {result.inserted} row(s) imported{result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.
              </p>
            </div>
          )}

          {result?.parseErrors?.length > 0 && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg max-h-32 overflow-y-auto">
              <div className="flex items-center gap-2 text-red-400 font-medium text-sm mb-1">
                <FiAlertCircle className="w-4 h-4" />
                Parse Errors
              </div>
              <ul className="text-xs text-red-300/80 space-y-0.5 list-disc list-inside">
                {result.parseErrors.slice(0, 10).map((err, i) => (
                  <li key={i}>{typeof err === 'string' ? err : JSON.stringify(err)}</li>
                ))}
                {result.parseErrors.length > 10 && <li>...and {result.parseErrors.length - 10} more</li>}
              </ul>
            </div>
          )}

          {/* Upload Button */}
          <button
            id="upload-submit"
            onClick={handleUpload}
            disabled={!file || loading}
            className="w-full py-3 px-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold rounded-xl shadow-lg shadow-brand-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <FiUploadCloud className="w-4.5 h-4.5" />
                Upload & Import
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
