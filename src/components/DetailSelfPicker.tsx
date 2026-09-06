import { Check } from 'lucide-react';
import {
  DETAIL_FAMILIES,
  DETAIL_FAMILY_COPY,
  DETAIL_SELF_COPY,
  findDetailPackage,
  packageForSelf,
  serviceSelectGroups,
  type DetailFamily,
  type DetailPackage,
  type DetailSelf,
} from '@/lib/detailCatalog';
import { money } from '@/lib/data';

type PickerProps = {
  family: DetailFamily;
  self: DetailSelf;
  onChange: (family: DetailFamily, self: DetailSelf, pkg: DetailPackage) => void;
  tone?: 'cream' | 'dark';
};

export default function DetailSelfPicker({ family, self, onChange, tone = 'cream' }: PickerProps) {
  const selected = packageForSelf(family, self);
  return (
    <div className={`detail-selves detail-selves-${tone}`}>
      <div className="detail-selves-families" role="tablist" aria-label="Detail family">
        {DETAIL_FAMILIES.map((id) => {
          const copy = DETAIL_FAMILY_COPY[id];
          return (
            <button
              type="button"
              key={id}
              role="tab"
              aria-selected={family === id}
              className={family === id ? 'active' : ''}
              onClick={() => onChange(id, self, packageForSelf(id, self))}
            >
              <small>{copy.kicker}</small>
              <strong>{copy.title}</strong>
            </button>
          );
        })}
      </div>
      <p className="detail-selves-blurb">{DETAIL_FAMILY_COPY[family].blurb}</p>
      <div className="detail-selves-grid">
        {(['essential', 'signature', 'elite'] as DetailSelf[]).map((id) => {
          const pkg = packageForSelf(family, id);
          const copy = DETAIL_SELF_COPY[id];
          return (
            <button
              type="button"
              key={pkg.id}
              className={`detail-self-card ${pkg.self === self ? 'active' : ''} ${pkg.featured ? 'featured' : ''}`}
              onClick={() => onChange(family, id, pkg)}
            >
              <span>{copy.tag}</span>
              <h3>{copy.title}</h3>
              <strong>{money(pkg.price)}<small>+</small></strong>
              <p>{pkg.desc}</p>
              <ul>
                {pkg.features.slice(0, 5).map((feature) => (
                  <li key={feature}><Check size={14} />{feature}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
      <p className="detail-selves-picked">{selected.name} · about {selected.minutes} min</p>
    </div>
  );
}

type SelectProps = {
  value: string;
  onChange: (name: string, pkg?: DetailPackage) => void;
  allowEmpty?: boolean;
};

export function ServiceMenuSelect({ value, onChange, allowEmpty }: SelectProps) {
  const known = Boolean(findDetailPackage(value));
  return (
    <select
      value={known ? findDetailPackage(value)?.name || value : value}
      onChange={(e) => onChange(e.target.value, findDetailPackage(e.target.value))}
    >
      {allowEmpty && <option value="">Choose a service</option>}
      {!known && value ? <option value={value}>{value}</option> : null}
      {serviceSelectGroups().map((group) => (
        <optgroup key={group.label} label={group.label}>
          {group.items.map((pkg) => (
            <option key={pkg.id} value={pkg.name}>{pkg.name} · {money(pkg.price)}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
