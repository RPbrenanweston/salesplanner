import { useState } from 'react';
import { Upload } from 'lucide-react';
import ImportCSVModal from '../components/ImportCSVModal';

export default function Lists() {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleImportComplete = () => {
    // Refresh lists/contacts data here when other stories implement the data fetching
    console.log('Import completed, refresh data');
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Contact Lists
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your contact lists and segments
          </p>
        </div>

        <button
          onClick={() => setIsImportModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Upload className="w-4 h-4" />
          Import CSV
        </button>
      </div>

      <ImportCSVModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
}
