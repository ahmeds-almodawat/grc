import { useEffect, useMemo, useState } from 'react';
import { DataState } from '../components/DataState';
import { KpiTile, ModernCard, StatusPill } from '../components/ModernCard';
import {
  getClinicalAreaRegister,
  getCommitteeRegister,
  getHospitalLocationRegister,
  getHospitalServiceRegister,
  getJobTitleRegister,
  getMasterDataExceptionRegister,
  getMasterDataOwnershipRegister,
  getQualityIndicatorRegister,
  type HospitalMasterDataRow,
  type MasterDataExceptionRow,
  type OwnershipMappingRow,
} from '../lib/hospitalMasterDataApi';
import { getLiveResultMessage, isLive, type LiveResult } from '../lib/liveResult';

function emptyRows<T>(message: string): LiveResult<T[]> {
  return { status: 'empty', data: null, source: 'system', isLive: false, generatedAt: new Date(0).toISOString(), message };
}

function rows<T>(result: LiveResult<T[]>): T[] {
  return isLive(result) ? result.data : [];
}

function value(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'boolean') return v ? 'Active' : 'Inactive';
  return String(v).replaceAll('_', ' ');
}

function getText(row: HospitalMasterDataRow, keys: string[]): string {
  for (const key of keys) {
    if (row[key]) return value(row[key]);
  }
  return '-';
}

function MasterTable({ data, label, codeKeys, nameKeys, typeKeys }: { data: HospitalMasterDataRow[]; label: string; codeKeys: string[]; nameKeys: string[]; typeKeys: string[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Owner</th><th>Department</th><th>Status</th></tr></thead>
        <tbody>
          {data.length === 0 ? (
            <tr><td colSpan={6}><strong>No {label} records returned.</strong></td></tr>
          ) : data.slice(0, 100).map(row => (
            <tr key={row.id ?? getText(row, codeKeys)}>
              <td><strong>{getText(row, codeKeys)}</strong></td>
              <td>{getText(row, nameKeys)}</td>
              <td>{getText(row, typeKeys)}</td>
              <td>{value(row.owner_name_en ?? row.chair_name_en)}</td>
              <td>{value(row.department_name_en)}</td>
              <td><StatusPill tone={row.active === false ? 'danger' : 'good'}>{value(row.active)}</StatusPill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExceptionTable({ data }: { data: MasterDataExceptionRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Type</th><th>Code</th><th>Name</th><th>Exception</th><th>Status</th></tr></thead>
        <tbody>
          {data.length === 0 ? <tr><td colSpan={5}><strong>No master data exceptions returned.</strong></td></tr> : data.slice(0, 100).map(row => (
            <tr key={`${row.item_type}-${row.item_id}`}>
              <td>{value(row.item_type)}</td>
              <td><strong>{value(row.item_code)}</strong></td>
              <td>{value(row.item_name)}</td>
              <td><StatusPill tone="warning">{value(row.exception_type)}</StatusPill></td>
              <td>{value(row.active)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OwnershipTable({ data }: { data: OwnershipMappingRow[] }) {
  return (
    <div className="table-scroll">
      <table className="entity-table">
        <thead><tr><th>Owner</th><th>Governed entity</th><th>Role</th><th>Status</th></tr></thead>
        <tbody>
          {data.length === 0 ? <tr><td colSpan={4}><strong>No ownership mapping records returned.</strong></td></tr> : data.slice(0, 100).map(row => (
            <tr key={row.id}>
              <td><strong>{value(row.owner_entity_name)}</strong><br /><small>{value(row.owner_entity_type)}</small></td>
              <td>{value(row.governed_entity_type)}<br /><small>{value(row.governed_entity_id)}</small></td>
              <td>{value(row.ownership_role)}</td>
              <td><StatusPill tone={row.active === false ? 'danger' : 'good'}>{value(row.active)}</StatusPill></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HospitalMasterDataCenter() {
  const [locations, setLocations] = useState<LiveResult<HospitalMasterDataRow[]>>(emptyRows('No locations loaded yet.'));
  const [services, setServices] = useState<LiveResult<HospitalMasterDataRow[]>>(emptyRows('No services loaded yet.'));
  const [areas, setAreas] = useState<LiveResult<HospitalMasterDataRow[]>>(emptyRows('No clinical areas loaded yet.'));
  const [committees, setCommittees] = useState<LiveResult<HospitalMasterDataRow[]>>(emptyRows('No committees loaded yet.'));
  const [jobTitles, setJobTitles] = useState<LiveResult<HospitalMasterDataRow[]>>(emptyRows('No job titles loaded yet.'));
  const [indicators, setIndicators] = useState<LiveResult<HospitalMasterDataRow[]>>(emptyRows('No indicators loaded yet.'));
  const [exceptions, setExceptions] = useState<LiveResult<MasterDataExceptionRow[]>>(emptyRows('No exceptions loaded yet.'));
  const [ownership, setOwnership] = useState<LiveResult<OwnershipMappingRow[]>>(emptyRows('No ownership mappings loaded yet.'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      const results = await Promise.all([
        getHospitalLocationRegister(),
        getHospitalServiceRegister(),
        getClinicalAreaRegister(),
        getCommitteeRegister(),
        getJobTitleRegister(),
        getQualityIndicatorRegister(),
        getMasterDataExceptionRegister(),
        getMasterDataOwnershipRegister(),
      ]);
      if (!mounted) return;
      setLocations(results[0]);
      setServices(results[1]);
      setAreas(results[2]);
      setCommittees(results[3]);
      setJobTitles(results[4]);
      setIndicators(results[5]);
      setExceptions(results[6]);
      setOwnership(results[7]);
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, []);

  const locationRows = rows(locations);
  const serviceRows = rows(services);
  const areaRows = rows(areas);
  const committeeRows = rows(committees);
  const jobTitleRows = rows(jobTitles);
  const indicatorRows = rows(indicators);
  const exceptionRows = rows(exceptions);
  const ownershipRows = rows(ownership);
  const hasAnyData = locationRows.length + serviceRows.length + areaRows.length + committeeRows.length + jobTitleRows.length + indicatorRows.length + exceptionRows.length + ownershipRows.length > 0;
  const messages = useMemo(() => ([locations, services, areas, committees, jobTitles, indicators, exceptions, ownership] as LiveResult<unknown>[])
    .filter(result => !isLive(result))
    .map(result => getLiveResultMessage(result))
    .filter((message, index, all) => all.indexOf(message) === index), [locations, services, areas, committees, jobTitles, indicators, exceptions, ownership]);

  return (
    <div className="page-stack hospital-master-data-center">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Hospital Master Data</p>
          <h1>Governed ownership and operating master data</h1>
          <p className="section-subtitle">Locations, services, clinical areas, committees, job titles, indicators, and ownership mappings for consistent hospital governance operations.</p>
        </div>
      </section>
      <DataState loading={loading} empty={!loading && !hasAnyData} emptyTitle="No governed hospital master data is visible yet" emptyMessage={messages[0] ?? 'Create governed master data records to standardize ownership, reporting, and workflow routing.'}>
        <div className="kpi-grid">
          <KpiTile label="Locations" value={locationRows.length} />
          <KpiTile label="Services" value={serviceRows.length} />
          <KpiTile label="Clinical areas" value={areaRows.length} />
          <KpiTile label="Committees" value={committeeRows.length} />
          <KpiTile label="Indicators" value={indicatorRows.length} />
          <KpiTile label="Exceptions" value={exceptionRows.length} tone={exceptionRows.length > 0 ? 'warning' : 'good'} />
        </div>
        <ModernCard title="Locations"><MasterTable data={locationRows} label="location" codeKeys={['location_code']} nameKeys={['location_name']} typeKeys={['location_type']} /></ModernCard>
        <ModernCard title="Services"><MasterTable data={serviceRows} label="service" codeKeys={['service_code']} nameKeys={['service_name']} typeKeys={['service_type']} /></ModernCard>
        <ModernCard title="Clinical areas"><MasterTable data={areaRows} label="clinical area" codeKeys={['area_code']} nameKeys={['area_name']} typeKeys={['area_type']} /></ModernCard>
        <ModernCard title="Committees"><MasterTable data={committeeRows} label="committee" codeKeys={['committee_code']} nameKeys={['committee_name']} typeKeys={['committee_type']} /></ModernCard>
        <ModernCard title="Job titles"><MasterTable data={jobTitleRows} label="job title" codeKeys={['job_title_code']} nameKeys={['job_title_name']} typeKeys={['staff_category']} /></ModernCard>
        <ModernCard title="Quality indicators"><MasterTable data={indicatorRows} label="quality indicator" codeKeys={['indicator_code']} nameKeys={['indicator_name']} typeKeys={['indicator_domain']} /></ModernCard>
        <ModernCard title="Ownership mappings"><OwnershipTable data={ownershipRows} /></ModernCard>
        <ModernCard title="Master data exceptions"><ExceptionTable data={exceptionRows} /></ModernCard>
      </DataState>
    </div>
  );
}
