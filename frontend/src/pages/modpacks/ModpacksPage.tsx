import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Input, Badge, DataTable, SearchableSelect } from '../../components/ui';
import type { Column } from '../../components/ui';
import { Download, AlertCircle, Settings, Search, X, ExternalLink, Grid, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { useModtaleStore } from '../../stores/modtaleStore';
import { useToast } from '../../stores/toastStore';
import { useInstallationQueueStore } from '../../stores/installationQueueStore';
import { searchProjects } from '../../services/modtaleApi';
import type { ModtaleProject } from '../../types/modtale';
import { ServerSelectionModal } from '../../components/modals/ServerSelectionModal';
import api from '../../services/api';

export const ModpacksPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { apiKey } = useModtaleStore();
  const { addToQueue } = useInstallationQueueStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modpacks, setModpacks] = useState<ModtaleProject[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ModtaleProject | null>(null);
  const [servers, setServers] = useState<any[]>([]);

  // Fetch servers on mount
  useEffect(() => {
    const fetchServers = async () => {
      try {
        const data = await api.getServers();
        setServers(data);
      } catch (err) {
        console.error('Failed to fetch servers:', err);
      }
    };
    fetchServers();
  }, []);

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'downloads' | 'rating' | 'updated'>('downloads');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterAuthor, setFilterAuthor] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [cardPage, setCardPage] = useState(1);
  const CARD_PAGE_SIZE = 9;

  // Fetch ALL modpacks from Modtale API once on mount
  useEffect(() => {
    if (apiKey && modpacks.length === 0) {
      fetchAllModpacks();
    }
  }, [apiKey]);

  const fetchAllModpacks = async () => {
    if (!apiKey) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch all modpacks (up to 2000) in one request - page is 0-indexed
      const response = await searchProjects({
        classification: 'MODPACK',
        page: 0,
        limit: 2000,
        sortBy: 'downloads',
        sortOrder: 'desc',
      });

      setModpacks(response.projects);
      setTotalResults(response.total);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch modpacks';
      setError(errorMessage);
      toast.error('Failed to load modpacks', errorMessage);
      console.error('Modtale API error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique tags and authors for filter dropdowns
  const uniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    modpacks.forEach(modpack => {
      modpack.tags?.forEach(tag => tagSet.add(tag.name));
    });
    return Array.from(tagSet).sort();
  }, [modpacks]);

  const uniqueAuthors = useMemo(() => {
    const authorSet = new Set<string>();
    modpacks.forEach(modpack => {
      if (modpack.author?.username) {
        authorSet.add(modpack.author.username);
      }
    });
    return Array.from(authorSet).sort();
  }, [modpacks]);

  // Filter and sort modpacks client-side
  const filteredModpacks = useMemo(() => {
    let filtered = modpacks;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.title.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query) ||
        m.author?.username?.toLowerCase().includes(query)
      );
    }

    // Filter by tags (multiple)
    if (filterTags.length > 0) {
      filtered = filtered.filter(m =>
        filterTags.every(filterTag =>
          m.tags?.some(tag => tag.name === filterTag)
        )
      );
    }

    // Filter by author
    if (filterAuthor !== 'all') {
      filtered = filtered.filter(m => m.author?.username === filterAuthor);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'downloads') return b.downloads - a.downloads;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (sortBy === 'updated') {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      }
      return 0;
    });

    return filtered;
  }, [modpacks, searchQuery, filterTags, filterAuthor, sortBy]);

  // Paginate modpacks for card view
  const paginatedModpacks = useMemo(() => {
    const startIndex = (cardPage - 1) * CARD_PAGE_SIZE;
    return filteredModpacks.slice(startIndex, startIndex + CARD_PAGE_SIZE);
  }, [filteredModpacks, cardPage]);

  const totalCardPages = Math.ceil(filteredModpacks.length / CARD_PAGE_SIZE);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCardPage(1);
  }, [searchQuery, filterTags, filterAuthor, sortBy]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
  };

  const handleSortChange = (value: 'downloads' | 'rating' | 'updated') => {
    setSortBy(value);
  };

  // Generate Modtale project URL
  const getModtaleUrl = (project: ModtaleProject) => {
    const titleSlug = project.title.toLowerCase().replace(/\s+/g, '-');
    const classification = project.classification.toLowerCase();
    return `https://modtale.net/${classification}/${titleSlug}-${project.id}`;
  };

  const handleInstallClick = (project: ModtaleProject) => {
    setSelectedProject(project);
    setShowInstallModal(true);
  };

  const handleInstall = async (serverId: string, projectId: string, versionId: string) => {
    if (!selectedProject) return;

    const server = servers.find(s => s.id === serverId);
    if (!server) return;

    const version = selectedProject.versions?.find(v => v.id === versionId) || selectedProject.latestVersion;

    // Add to installation queue for UI feedback
    const queueId = addToQueue({
      serverId,
      serverName: server.name,
      projectId,
      projectTitle: selectedProject.title,
      projectIconUrl: selectedProject.iconUrl,
      versionId,
      versionName: version?.version || 'Latest',
      classification: selectedProject.classification,
    });

    // Update status to downloading
    const { updateStatus, removeFromQueue } = useInstallationQueueStore.getState();
    updateStatus(queueId, 'downloading');

    toast.success(
      'Installing...',
      `${selectedProject.title} is being installed to ${server.name}`
    );

    // Call backend API to actually install the modpack
    try {
      updateStatus(queueId, 'installing');
      await api.installMod(serverId, {
        projectId,
        projectTitle: selectedProject.title,
        projectIconUrl: selectedProject.iconUrl,
        versionId,
        versionName: version?.version || 'Latest',
        classification: selectedProject.classification,
        fileSize: 0,
      });
      updateStatus(queueId, 'completed');
      toast.success('Installation complete', `${selectedProject.title} has been installed`);

      // Remove from queue after a short delay so user can see completion
      setTimeout(() => removeFromQueue(queueId), 2000);
    } catch (error: any) {
      console.error('Error installing modpack:', error);
      updateStatus(queueId, 'failed', error.message);
      toast.error('Installation failed', error.message);

      // Remove failed items after showing error
      setTimeout(() => removeFromQueue(queueId), 5000);
    }
  };

  // DataTable columns
  const columns: Column<ModtaleProject>[] = [
    {
      key: 'title',
      label: 'Modpack',
      sortable: true,
      render: (modpack) => (
        <div className="flex items-center gap-3">
          <img
            src={modpack.iconUrl || `https://via.placeholder.com/48/6366f1/ffffff?text=${modpack.title[0]}`}
            alt={modpack.title}
            className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
          />
          <div className="min-w-0">
            <p className="font-medium text-text-light-primary dark:text-text-primary truncate">{modpack.title}</p>
            <p className="text-sm text-text-light-muted dark:text-text-muted truncate">{modpack.description}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'author',
      label: 'Author',
      sortable: true,
      render: (modpack) => (
        <span className="whitespace-nowrap">{modpack.author.username}</span>
      ),
    },
    {
      key: 'tags',
      label: 'Tags',
      sortable: false,
      className: 'hidden md:table-cell',
      render: (modpack) => (
        <div className="flex flex-wrap gap-1">
          {modpack.tags.slice(0, 2).map((tag) => (
            <Badge key={tag.id} size="sm" variant="info">
              {tag.name}
            </Badge>
          ))}
          {modpack.tags.length > 2 && (
            <Badge size="sm" variant="default">
              +{modpack.tags.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'downloads',
      label: 'Downloads',
      sortable: true,
      className: 'text-right',
      render: (modpack) => (
        <span className="whitespace-nowrap">{modpack.downloads.toLocaleString()}</span>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      className: 'text-right',
      render: (modpack) => (
        <span className="whitespace-nowrap">⭐ {modpack.rating.toFixed(1)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      className: 'text-right',
      render: (modpack) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="primary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => handleInstallClick(modpack)}
          >
            Install
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<ExternalLink size={14} />}
            onClick={() => window.open(getModtaleUrl(modpack), '_blank')}
          >
            View
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-heading font-bold text-text-light-primary dark:text-text-primary">Modpacks</h1>
        <p className="text-text-light-muted dark:text-text-muted mt-1">
          Pre-configured mod collections for quick setup {totalResults > 0 && `(${totalResults.toLocaleString()} available)`}
          {' • '}Powered by{' '}
          <a
            href="https://modtale.net"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-primary hover:underline"
          >
            Modtale
          </a>
        </p>
      </div>

      {/* Search and Filters */}
      {apiKey && (
        <Card variant="glass" className="relative z-10 overflow-visible">
          <CardContent className="py-4 overflow-visible">
            <div className="flex flex-col gap-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-light-muted dark:text-text-muted" size={20} />
                <Input
                  type="text"
                  placeholder="Search modpacks..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearch('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-light-muted dark:text-text-muted hover:text-text-light-primary dark:hover:text-text-primary"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>

              {/* Filter Row */}
              <div className="flex flex-col md:flex-row gap-4 relative z-20">
                {/* Tags Filter */}
                <div className="w-full md:w-48">
                  <SearchableSelect
                    options={uniqueTags}
                    value={filterTags}
                    onChange={(value) => setFilterTags(value as string[])}
                    placeholder="All Tags"
                    searchPlaceholder="Search tags..."
                    multiple={true}
                    allLabel="All Tags"
                  />
                </div>

                {/* Author Filter */}
                <div className="w-full md:w-48">
                  <SearchableSelect
                    options={uniqueAuthors}
                    value={filterAuthor}
                    onChange={(value) => setFilterAuthor(value as string)}
                    placeholder="All Authors"
                    searchPlaceholder="Search authors..."
                    multiple={false}
                    allLabel="All Authors"
                  />
                </div>

                {/* Sort Dropdown */}
                <div className="w-full md:w-48">
                  <select
                    value={sortBy}
                    onChange={(e) => handleSortChange(e.target.value as 'downloads' | 'rating' | 'updated')}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-text-light-primary dark:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                  >
                    <option value="downloads">Most Downloads</option>
                    <option value="rating">Highest Rated</option>
                    <option value="updated">Recently Updated</option>
                  </select>
                </div>

                {/* View Toggle */}
                <div className="flex gap-2 md:ml-auto">
                  <button
                    onClick={() => setViewMode('card')}
                    className={`p-2 rounded-lg border transition-colors ${
                      viewMode === 'card'
                        ? 'bg-accent-primary text-white border-accent-primary'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-text-light-muted dark:text-text-muted hover:text-text-light-primary dark:hover:text-text-primary'
                    }`}
                    title="Card view"
                  >
                    <Grid size={20} />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-2 rounded-lg border transition-colors ${
                      viewMode === 'table'
                        ? 'bg-accent-primary text-white border-accent-primary'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-text-light-muted dark:text-text-muted hover:text-text-light-primary dark:hover:text-text-primary'
                    }`}
                    title="Table view"
                  >
                    <List size={20} />
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* API Key Warning */}
      {!apiKey && (
        <Card variant="glass">
          <CardContent>
            <div className="flex items-center gap-4 py-4">
              <AlertCircle size={32} className="text-warning" />
              <div className="flex-1">
                <h3 className="font-heading font-semibold text-text-light-primary dark:text-text-primary">
                  Modtale API Key Required
                </h3>
                <p className="text-sm text-text-light-muted dark:text-text-muted mt-1">
                  To browse and install modpacks from Modtale, please configure your Enterprise API key in settings.
                </p>
              </div>
              <Button
                variant="primary"
                icon={<Settings size={18} />}
                onClick={() => navigate('/settings')}
              >
                Configure API Key
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-accent-primary border-t-transparent"></div>
          <p className="text-text-light-muted dark:text-text-muted mt-4">Loading modpacks from Modtale...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card variant="glass">
          <CardContent>
            <div className="flex items-center gap-4 py-4">
              <AlertCircle size={32} className="text-danger" />
              <div className="flex-1">
                <h3 className="font-heading font-semibold text-text-light-primary dark:text-text-primary">
                  Failed to Load Modpacks
                </h3>
                <p className="text-sm text-text-light-muted dark:text-text-muted mt-1">{error}</p>
              </div>
              <Button variant="secondary" onClick={fetchAllModpacks}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modpacks List */}
      {apiKey && !loading && !error && modpacks.length > 0 && (
        <div className="space-y-4">
          {/* Card View */}
          {viewMode === 'card' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedModpacks.map((modpack) => (
                <Card key={modpack.id} variant="glass" hover>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <img
                        src={modpack.iconUrl || `https://via.placeholder.com/48/6366f1/ffffff?text=${modpack.title[0]}`}
                        alt={modpack.title}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="truncate">{modpack.title}</CardTitle>
                        <CardDescription className="truncate">{modpack.author.username}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <p className="text-sm text-text-light-muted dark:text-text-muted line-clamp-2">{modpack.description}</p>

                    {/* Tags */}
                    {modpack.tags && modpack.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {modpack.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag.id} size="sm" variant="info">
                            {tag.name}
                          </Badge>
                        ))}
                        {modpack.tags.length > 3 && (
                          <Badge size="sm" variant="default">
                            +{modpack.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-text-light-muted dark:text-text-muted">
                        ⭐ {modpack.rating.toFixed(1)}
                      </span>
                      <span className="text-text-light-muted dark:text-text-muted">
                        {modpack.downloads.toLocaleString()} downloads
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Download size={14} />}
                        className="flex-1"
                        onClick={() => handleInstallClick(modpack)}
                      >
                        Install
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ExternalLink size={14} />}
                        onClick={() => window.open(getModtaleUrl(modpack), '_blank')}
                      >
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                ))}
              </div>

              {/* Card View Pagination */}
              {totalCardPages > 1 && (
                <div className="flex items-center justify-between mt-6 px-2">
                  <span className="text-sm text-text-light-muted dark:text-text-muted">
                    Showing {(cardPage - 1) * CARD_PAGE_SIZE + 1} to{' '}
                    {Math.min(cardPage * CARD_PAGE_SIZE, filteredModpacks.length)} of {filteredModpacks.length} modpacks
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ChevronLeft size={16} />}
                      onClick={() => setCardPage(p => Math.max(1, p - 1))}
                      disabled={cardPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-text-light-muted dark:text-text-muted px-2">
                      Page {cardPage} of {totalCardPages}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<ChevronRight size={16} />}
                      onClick={() => setCardPage(p => Math.min(totalCardPages, p + 1))}
                      disabled={cardPage === totalCardPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <DataTable
              data={filteredModpacks}
              columns={columns}
              keyExtractor={(modpack) => modpack.id}
              itemsPerPage={10}
              searchable={true}
              exportable={true}
            />
          )}
        </div>
      )}

      {/* Empty State */}
      {apiKey && !loading && !error && modpacks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-text-light-muted dark:text-text-muted">No modpacks available</p>
        </div>
      )}

      {/* Server Selection Modal */}
      <ServerSelectionModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        project={selectedProject}
        onInstall={handleInstall}
      />
    </div>
  );
};
