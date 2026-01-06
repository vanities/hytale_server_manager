import { useState, useEffect } from 'react';
import { Modal, ModalFooter, Button, Input, Badge } from '../ui';
import { Network, Server, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import type { CreateNetworkDto, NetworkType } from '../../types';

interface ServerOption {
  id: string;
  name: string;
  status: string;
}

interface CreateNetworkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateNetworkDto) => Promise<void>;
  availableServers: ServerOption[];
  isLoadingServers?: boolean;
}

type Step = 'basics' | 'servers';

const NETWORK_COLORS = [
  '#00FF88', // Green (default)
  '#00D4FF', // Cyan
  '#FF6B6B', // Red
  '#FFE66D', // Yellow
  '#A855F7', // Purple
  '#F97316', // Orange
  '#EC4899', // Pink
  '#3B82F6', // Blue
];

export const CreateNetworkModal = ({
  isOpen,
  onClose,
  onSubmit,
  availableServers,
  isLoadingServers,
}: CreateNetworkModalProps) => {
  const [step, setStep] = useState<Step>('basics');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form data
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [networkType, setNetworkType] = useState<NetworkType>('logical');
  const [color, setColor] = useState(NETWORK_COLORS[0]);
  const [proxyServerId, setProxyServerId] = useState<string | null>(null);
  const [startOrder, setStartOrder] = useState<'proxy_first' | 'backends_first'>('proxy_first');
  const [selectedServerIds, setSelectedServerIds] = useState<Set<string>>(new Set());

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('basics');
      setName('');
      setDescription('');
      setNetworkType('logical');
      setColor(NETWORK_COLORS[0]);
      setProxyServerId(null);
      setStartOrder('proxy_first');
      setSelectedServerIds(new Set());
      setErrors({});
    }
  }, [isOpen]);

  const validateBasics = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Network name is required';
    } else if (name.length > 50) {
      newErrors.name = 'Name must be 50 characters or less';
    }

    if (description.length > 200) {
      newErrors.description = 'Description must be 200 characters or less';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateServers = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (networkType === 'proxy' && !proxyServerId) {
      newErrors.proxy = 'Please select a proxy server';
    }

    if (selectedServerIds.size === 0 && !proxyServerId) {
      newErrors.servers = 'Please select at least one server';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 'basics' && validateBasics()) {
      setStep('servers');
    }
  };

  const handleBack = () => {
    if (step === 'servers') {
      setStep('basics');
    }
  };

  const handleSubmit = async () => {
    if (!validateServers()) {
      return;
    }

    setLoading(true);
    try {
      const serverIds = Array.from(selectedServerIds);
      // If proxy is selected and not in serverIds, we still don't add it here
      // The backend will handle setting up the proxy server relationship

      const data: CreateNetworkDto = {
        name: name.trim(),
        description: description.trim() || undefined,
        networkType,
        color,
        serverIds: serverIds.length > 0 ? serverIds : undefined,
        proxyServerId: networkType === 'proxy' ? proxyServerId || undefined : undefined,
        proxyConfig: networkType === 'proxy' ? { startOrder } : undefined,
      };

      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error('Error creating network:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectAllServers = () => {
    const allIds = availableServers
      .filter(s => s.id !== proxyServerId)
      .map(s => s.id);
    setSelectedServerIds(new Set(allIds));
  };

  const clearSelection = () => {
    setSelectedServerIds(new Set());
  };

  // Filter out proxy server from selectable servers
  const selectableServers = availableServers.filter(s => s.id !== proxyServerId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Network"
      size="lg"
    >
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-2 mb-6">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            step === 'basics'
              ? 'bg-accent-primary text-black'
              : 'bg-gray-700 text-text-muted'
          }`}
        >
          <span className="text-sm font-medium">1. Basics</span>
        </div>
        <ChevronRight size={16} className="text-text-muted" />
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
            step === 'servers'
              ? 'bg-accent-primary text-black'
              : 'bg-gray-700 text-text-muted'
          }`}
        >
          <span className="text-sm font-medium">2. Servers</span>
        </div>
      </div>

      {/* Step Content */}
      {step === 'basics' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 bg-primary-bg-secondary rounded-lg">
            <div className="p-3 bg-accent-primary/20 rounded-lg">
              <Network className="text-accent-primary" size={24} />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-text-light-primary dark:text-text-primary">
                Network Configuration
              </h3>
              <p className="text-sm text-text-light-muted dark:text-text-muted">
                Set up basic network properties
              </p>
            </div>
          </div>

          {/* Network Name */}
          <div>
            <label className="block text-sm font-medium text-text-light-primary dark:text-text-primary mb-2">
              Network Name *
            </label>
            <Input
              type="text"
              placeholder="My Server Network"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
              }}
            />
            {errors.name && (
              <p className="text-danger text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-light-primary dark:text-text-primary mb-2">
              Description
            </label>
            <textarea
              placeholder="Optional description of this network..."
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors(prev => ({ ...prev, description: '' }));
              }}
              rows={2}
              className="w-full px-4 py-2 bg-white dark:bg-primary-bg border border-gray-300 dark:border-gray-700 rounded-lg text-text-light-primary dark:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 resize-none"
            />
            {errors.description && (
              <p className="text-danger text-sm mt-1">{errors.description}</p>
            )}
          </div>

          {/* Network Type */}
          <div>
            <label className="block text-sm font-medium text-text-light-primary dark:text-text-primary mb-2">
              Network Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNetworkType('logical')}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  networkType === 'logical'
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="font-medium text-text-light-primary dark:text-text-primary mb-1">
                  Logical Group
                </div>
                <p className="text-xs text-text-light-muted dark:text-text-muted">
                  Organize servers together for easier management
                </p>
              </button>
              <button
                type="button"
                onClick={() => setNetworkType('proxy')}
                className={`p-4 rounded-lg border-2 text-left transition-all ${
                  networkType === 'proxy'
                    ? 'border-accent-primary bg-accent-primary/10'
                    : 'border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="font-medium text-text-light-primary dark:text-text-primary mb-1">
                  Proxy Network
                </div>
                <p className="text-xs text-text-light-muted dark:text-text-muted">
                  Proxy server with backend servers (BungeeCord-style)
                </p>
              </button>
            </div>
          </div>

          {/* Proxy Start Order (only for proxy networks) */}
          {networkType === 'proxy' && (
            <div>
              <label className="block text-sm font-medium text-text-light-primary dark:text-text-primary mb-2">
                Start Order
              </label>
              <select
                value={startOrder}
                onChange={(e) => setStartOrder(e.target.value as 'proxy_first' | 'backends_first')}
                className="w-full px-4 py-2 bg-white dark:bg-primary-bg border border-gray-300 dark:border-gray-700 rounded-lg text-text-light-primary dark:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              >
                <option value="proxy_first">Start proxy first, then backends</option>
                <option value="backends_first">Start backends first, then proxy</option>
              </select>
              <p className="text-xs text-text-light-muted dark:text-text-muted mt-1">
                Determines the order servers start when using "Start All"
              </p>
            </div>
          )}

          {/* Network Color */}
          <div>
            <label className="block text-sm font-medium text-text-light-primary dark:text-text-primary mb-2">
              Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {NETWORK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'servers' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3 p-4 bg-primary-bg-secondary rounded-lg">
            <div className="p-3 bg-accent-primary/20 rounded-lg">
              <Server className="text-accent-primary" size={24} />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-text-light-primary dark:text-text-primary">
                Select Servers
              </h3>
              <p className="text-sm text-text-light-muted dark:text-text-muted">
                {networkType === 'proxy'
                  ? 'Choose proxy and backend servers'
                  : 'Choose servers to include in this network'}
              </p>
            </div>
          </div>

          {/* Proxy Server Selection (for proxy networks) */}
          {networkType === 'proxy' && (
            <div>
              <label className="block text-sm font-medium text-text-light-primary dark:text-text-primary mb-2">
                Proxy Server *
              </label>
              <select
                value={proxyServerId || ''}
                onChange={(e) => {
                  setProxyServerId(e.target.value || null);
                  // Remove from selected servers if it was selected
                  if (e.target.value && selectedServerIds.has(e.target.value)) {
                    setSelectedServerIds(prev => {
                      const next = new Set(prev);
                      next.delete(e.target.value);
                      return next;
                    });
                  }
                  if (errors.proxy) setErrors(prev => ({ ...prev, proxy: '' }));
                }}
                className="w-full px-4 py-2 bg-white dark:bg-primary-bg border border-gray-300 dark:border-gray-700 rounded-lg text-text-light-primary dark:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
              >
                <option value="">Select a proxy server...</option>
                {availableServers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </select>
              {errors.proxy && (
                <p className="text-danger text-sm mt-1">{errors.proxy}</p>
              )}
            </div>
          )}

          {/* Server Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-light-primary dark:text-text-primary">
                {networkType === 'proxy' ? 'Backend Servers' : 'Member Servers'}
              </label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllServers}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>

            {isLoadingServers ? (
              <div className="text-center py-8 text-text-muted">
                Loading servers...
              </div>
            ) : selectableServers.length === 0 ? (
              <div className="text-center py-8 text-text-muted">
                {availableServers.length === 0
                  ? 'No servers available'
                  : networkType === 'proxy' && proxyServerId
                  ? 'No other servers available (all assigned as proxy)'
                  : 'No servers available'}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-gray-700 rounded-lg">
                {selectableServers.map((server) => (
                  <div
                    key={server.id}
                    onClick={() => {
                      setSelectedServerIds(prev => {
                        const next = new Set(prev);
                        if (next.has(server.id)) {
                          next.delete(server.id);
                        } else {
                          next.add(server.id);
                        }
                        return next;
                      });
                      if (errors.servers) {
                        setErrors(prev => ({ ...prev, servers: '' }));
                      }
                    }}
                    className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition-colors border-b border-gray-800 last:border-b-0 ${
                      selectedServerIds.has(server.id) ? 'bg-accent-primary/10' : ''
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedServerIds.has(server.id)
                          ? 'bg-accent-primary border-accent-primary'
                          : 'border-gray-600'
                      }`}
                    >
                      {selectedServerIds.has(server.id) && (
                        <Check size={14} className="text-black" />
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="text-text-light-primary dark:text-text-primary">
                        {server.name}
                      </span>
                    </div>
                    <Badge
                      variant={server.status === 'running' ? 'success' : 'default'}
                      size="sm"
                    >
                      {server.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {errors.servers && (
              <p className="text-danger text-sm mt-1">{errors.servers}</p>
            )}

            <p className="text-xs text-text-light-muted dark:text-text-muted mt-2">
              {selectedServerIds.size} server{selectedServerIds.size !== 1 ? 's' : ''} selected
            </p>
          </div>
        </div>
      )}

      <ModalFooter>
        {step === 'basics' ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleNext}
              icon={<ChevronRight size={16} />}
            >
              Next
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              onClick={handleBack}
              icon={<ChevronLeft size={16} />}
            >
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Network'}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
};
