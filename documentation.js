(function() {
  function EntityCard({ entityKey, entity, isSelected, onSelect }) {
    return React.createElement(
      'div',
      {
        onClick: () => onSelect(entityKey),
        className: `entity-card cursor-pointer rounded-lg border-2 p-4 transition-all ${
          isSelected
            ? 'border-blue-500 shadow-lg scale-105'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
        } bg-white dark:bg-gray-800`
      },
      React.createElement(
        'div',
        { className: 'flex items-center gap-2 mb-2' },
        React.createElement(
          'div',
          { className: `p-2 rounded ${entity.color} bg-opacity-10` },
          React.createElement('i', { 'data-lucide': entity.icon, className: 'w-5 h-5' })
        ),
        React.createElement('h3', { className: 'font-semibold' }, entity.name)
      ),
      React.createElement(
        'p',
        { className: 'text-sm text-gray-600 dark:text-gray-400 mb-3' },
        entity.description
      ),
      isSelected && React.createElement(
        'div',
        { className: 'space-y-1 text-sm border-t border-gray-200 dark:border-gray-700 pt-3 mt-3 fade-in' },
        entity.attributes.map((attr, i) => 
          React.createElement(
            'div',
            { key: i, className: 'flex items-center gap-2' },
            React.createElement(
              'span',
              {
                className: attr.includes('(PK)') ? 'text-blue-600 dark:text-blue-400' :
                          attr.includes('(FK)') ? 'text-green-600 dark:text-green-400' :
                          'text-gray-600 dark:text-gray-400'
              },
              attr
            )
          )
        )
      )
    );
  }

  function App() {
    const [selectedEntity, setSelectedEntity] = React.useState(null);

    const entities = {
      users: {
        name: 'Users',
        icon: 'users',
        color: 'bg-blue-500',
        attributes: ['uid (PK)', 'email', 'displayName', 'photoURL', 'createdAt'],
        description: 'System users with authentication'
      },
      systems: {
        name: 'Systems',
        icon: 'database',
        color: 'bg-purple-500',
        attributes: ['id (PK)', 'userId (FK)', 'name', 'description', 'icon', 'createdAt', 'updatedAt'],
        description: 'Top-level organizational containers'
      },
      categories: {
        name: 'Categories',
        icon: 'folder',
        color: 'bg-green-500',
        attributes: ['id (PK)', 'userId (FK)', 'systemId (FK)', 'parentId (FK)', 'name', 'note', 'archived', 'tags', 'createdAt', 'updatedAt'],
        description: 'Hierarchical categories within systems'
      },
      records: {
        name: 'Records',
        icon: 'file-text',
        color: 'bg-orange-500',
        attributes: ['id (PK)', 'userId (FK)', 'systemId (FK)', 'categoryId (FK)', 'title', 'description', 'status', 'tags', 'createdAt', 'updatedAt', 'archived'],
        description: 'Detailed records with custom fields'
      },
      customFields: {
        name: 'Custom Fields',
        icon: 'tag',
        color: 'bg-pink-500',
        attributes: ['id (PK)', 'recordId (FK)', 'label', 'type', 'value', 'required', 'order'],
        description: 'Dynamic custom attributes for records'
      },
      relations: {
        name: 'Relations',
        icon: 'link',
        color: 'bg-cyan-500',
        attributes: ['id (PK)', 'sourceRecordId (FK)', 'targetRecordId (FK)', 'relationType', 'description', 'createdAt'],
        description: 'Many-to-many record relationships'
      },
      relationTypes: {
        name: 'Relation Types',
        icon: 'link',
        color: 'bg-indigo-500',
        attributes: ['id (PK)', 'userId (FK)', 'systemId (FK)', 'name', 'displayName', 'description', 'icon', 'color', 'bidirectional', 'inverseLabel'],
        description: 'Predefined relationship type definitions'
      }
    };

    const relationships = [
      { from: 'users', to: 'systems', label: 'creates (1:N)', type: 'one-to-many' },
      { from: 'systems', to: 'categories', label: 'contains (1:N)', type: 'one-to-many' },
      { from: 'categories', to: 'categories', label: 'parent/child (1:N)', type: 'self-referencing' },
      { from: 'categories', to: 'records', label: 'contains (1:N)', type: 'one-to-many' },
      { from: 'records', to: 'customFields', label: 'has (1:N)', type: 'one-to-many' },
      { from: 'records', to: 'relations', label: 'links (N:M)', type: 'many-to-many' },
      { from: 'relationTypes', to: 'relations', label: 'defines (1:N)', type: 'one-to-many' }
    ];

    React.useEffect(() => {
      // Initialize Lucide icons after render
      lucide.createIcons();
    }, []);

    return React.createElement(
      'div',
      { className: 'space-y-8' },
      React.createElement(
        'div',
        { className: 'prose dark:prose-invert max-w-none mb-8' },
        React.createElement('h2', { className: 'text-2xl font-bold mb-4' }, 'Entity Relationship Diagram'),
        React.createElement(
          'p',
          { className: 'text-gray-600 dark:text-gray-400' },
          'This diagram shows the database structure and relationships between different entities in the system. Click on any entity to view its attributes. Primary keys are shown in blue, foreign keys in green.'
        )
      ),
      React.createElement(
        'div',
        { className: 'grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' },
        Object.entries(entities).map(([key, entity]) =>
          React.createElement(EntityCard, {
            key,
            entityKey: key,
            entity,
            isSelected: selectedEntity === key,
            onSelect: setSelectedEntity
          })
        )
      ),
      React.createElement(
        'div',
        { className: 'mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg' },
        React.createElement('h3', { className: 'font-semibold mb-3' }, 'Relationships'),
        React.createElement(
          'ul',
          { className: 'space-y-2' },
          relationships.map((rel, i) =>
            React.createElement(
              'li',
              { key: i, className: 'flex items-center gap-2 text-sm' },
              React.createElement('span', { className: 'font-medium' }, entities[rel.from].name),
              React.createElement('span', { className: 'text-gray-500' }, '→'),
              React.createElement('span', { className: 'font-medium' }, entities[rel.to].name),
              React.createElement('span', { className: 'text-gray-600 dark:text-gray-400' }, `(${rel.label})`)
            )
          )
        )
      )
    );
  }

  // Initialize the app
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
})();