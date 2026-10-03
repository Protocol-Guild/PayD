import React, { useState, useEffect, useRef } from 'react';

const AdvancedDropdown = ({ options, onChange, placeholder = "Select...", searchable = true, paginated = true, pageSize = 5 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [focusedOption, setFocusedOption] = useState(null);
  const dropdownRef = useRef(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option => 
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const indexOfLastItem = currentPage * pageSize;
  const indexOfFirstItem = indexOfLastItem - pageSize;
  const currentOptions = paginated ? filteredOptions.slice(indexOfFirstItem, indexOfLastItem) : filteredOptions;
  const totalPages = Math.ceil(filteredOptions.length / pageSize);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  const handleKeyDown = (event) => {
    if (!isOpen) {
      if (event.key === 'Enter' || event.key === ' ') {
        setIsOpen(true);
      }
      return;
    }

    const focusedIndex = currentOptions.findIndex(opt => opt === focusedOption);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedOption(currentOptions[(focusedIndex + 1) % currentOptions.length]);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedOption(currentOptions[(focusedIndex - 1 + currentOptions.length) % currentOptions.length]);
        break;
      case 'Enter':
        event.preventDefault();
        if (focusedOption) {
          onChange(focusedOption);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div className="advanced-dropdown" ref={dropdownRef} tabIndex="0" onKeyDown={handleKeyDown}>
      <div 
        className="dropdown-header"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{focusedOption ? focusedOption.label : placeholder}</span>
        <span className="arrow">{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && (
        <div className="dropdown-body">
          {searchable && (
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
          )}
          <ul className="options-list">
            {currentOptions.map(option => (
              <li
                key={option.value}
                className={`option ${focusedOption === option ? 'focused' : ''}`}
                onMouseEnter={() => setFocusedOption(option)}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </li>
            ))}
          </ul>
          {paginated && (
            <div className="pagination">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedDropdown;
