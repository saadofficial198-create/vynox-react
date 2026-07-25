import { useLocation, Outlet, useOutletContext } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { PAGE_META } from '../pageMeta';
import { ScannerProvider } from '../context/ScannerContext';
import '../styles/scanner.css';

export default function Layout() {
  const { pathname } = useLocation();
  const meta = PAGE_META[pathname] || PAGE_META['/'];
  const [pageClass, setPageClass] = useState('');
  const [searchValue, setSearchValue] = useState('');

  return (
    <ScannerProvider>
      <Sidebar />
      <div className="main">
        <Topbar meta={meta} onSearch={setSearchValue} />
        <div className="scroll-area">
          <div className={`content-wrap ${pageClass || ''}`.trim()}>
            <Outlet context={{ setPageClass, searchValue }} />
          </div>
        </div>
      </div>
    </ScannerProvider>
  );
}

export function usePage() {
  return useOutletContext();
}
