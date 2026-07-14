import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import AddCompanyModal from '../components/AddCompanyModal';
import * as companyApi from '../utils/companyApi';
import toast from 'react-hot-toast';

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

export default function CompanyOnboardingPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [managing, setManaging] = useState(null); // brand key
  const [products, setProducts] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await companyApi.listCompanies();
      setCompanies(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load companies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreated = (created) => {
    setShowAdd(false);
    toast.success(`Company ${created.brand} added`);
    load();
  };

  const handleManage = async (brand) => {
    setManaging(brand === managing ? null : brand);
    if (brand && brand !== managing) {
      try {
        const p = await companyApi.getProductsForCompany(brand);
        setProducts(p || []);
      } catch (err) {
        console.error(err);
        setProducts([]);
      }
    }
  };

  const handleDeactivate = async (brand) => {
    if (!confirm('Deactivate company? It will hide the company from new forms.')) return;
    try {
      await companyApi.deactivateCompany(brand);
      toast.success('Company deactivated');
      load();
      setManaging(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to deactivate');
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
    >
      <motion.div
        variants={{ hidden: { opacity: 0, y: 30 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 14 } } }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 bg-surface-900/50 backdrop-blur-2xl border border-surface-700/50 p-6 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-surface-400 tracking-tight">Company Onboarding</h2>
          <p className="text-sm text-surface-400 mt-1">Add and manage customer companies and their product masters.</p>
        </div>
        <div className="relative z-10 flex gap-3">
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-xl bg-brand-600 text-white">Add Company</button>
        </div>
      </motion.div>

      <div className="bg-surface-900 border border-surface-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Companies</h3>
          <div className="text-sm text-surface-400">{loading ? 'Loading…' : `${companies.length} companies`}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-surface-400 text-left">
                <th className="py-2 pr-4">Brand</th>
                <th className="py-2 pr-4">Company</th>
                <th className="py-2 pr-4">GSTIN</th>
                <th className="py-2 pr-4">Products</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.brand} className="border-t border-surface-800">
                  <td className="py-3 pr-4 font-medium">{c.brand}</td>
                  <td className="py-3 pr-4">{c.companyName}</td>
                  <td className="py-3 pr-4">{c.gstin || '—'}</td>
                  <td className="py-3 pr-4">{/* product count unknown client-side; show dash */}—</td>
                  <td className="py-3 pr-4">{c.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="py-3 pr-4">
                    <div className="flex gap-2">
                      <button onClick={() => handleManage(c.brand)} className="px-3 py-1 rounded-lg bg-surface-800 text-sm">Manage</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {managing && (
          <div className="mt-4 border-t border-surface-800 pt-4">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-semibold">Manage: {managing}</h4>
                <p className="text-sm text-surface-400">Edit company details or manage products for {managing}.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleDeactivate(managing)} className="px-3 py-1 rounded-lg bg-red-600 text-white text-sm">Deactivate</button>
                <button onClick={() => setManaging(null)} className="px-3 py-1 rounded-lg bg-surface-800 text-sm">Close</button>
              </div>
            </div>

            <div className="mt-3">
              <h5 className="font-medium">Products</h5>
              <div className="mt-2">
                {products.length === 0 ? (
                  <div className="text-surface-500 text-sm">No products configured. Use Add products from the product management UI.</div>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {products.map((p) => (
                      <li key={p.id} className="flex items-center justify-between bg-surface-800/50 p-2 rounded-md">
                        <div className="font-mono text-sm">{p.itemCode}</div>
                        <div className="ml-4 text-sm text-surface-300">{p.description}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showAdd && <AddCompanyModal onClose={() => setShowAdd(false)} onCreated={handleCreated} />}
    </motion.div>
  );
}
