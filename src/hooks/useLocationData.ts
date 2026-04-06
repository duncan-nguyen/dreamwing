import { useState, useEffect } from 'react';

export interface Province {
  code: number;
  name: string;
}

export interface Ward {
  code: number;
  name: string;
  district_code: number;
  district_name?: string;
}

export function useLocationData() {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('https://provinces.open-api.vn/api/p/')
      .then(res => res.json())
      .then(data => {
        setProvinces(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchWardsByProvince = (provinceCode: number) => {
    setLoading(true);
    fetch(`https://provinces.open-api.vn/api/p/${provinceCode}?depth=3`)
      .then(res => res.json())
      .then(data => {
        const allWards: Ward[] = [];
        if (data.districts) {
          data.districts.forEach((d: any) => {
            if (d.wards) {
              d.wards.forEach((w: any) => {
                allWards.push({ ...w, district_name: d.name });
              });
            }
          });
        }
        // Sort wards alphabetically for easier finding
        allWards.sort((a, b) => a.name.localeCompare(b.name));
        setWards(allWards);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  const clearWards = () => {
    setWards([]);
  };

  return { provinces, wards, fetchWardsByProvince, clearWards, loading };
}
