import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsNumberString, IsOptional, IsString, MinLength } from 'class-validator';
import { RequirePermissions } from '../../common/decorators/auth.decorators';

class ReverseGeocodeQuery {
  @IsNumberString()
  lat!: string;

  @IsNumberString()
  lng!: string;
}

class ForwardGeocodeQuery {
  @IsString()
  @MinLength(3)
  q!: string;

  @IsOptional()
  @IsString()
  country?: string;
}

/**
 * Server-side Nominatim proxy (no API key). Optional Google geocode when
 * GOOGLE_MAPS_API_KEY is set.
 */
@ApiTags('geo')
@Controller('geo')
export class GeoController {
  @Get('reverse')
  @RequirePermissions('delivery.read')
  async reverse(@Query() query: ReverseGeocodeQuery) {
    const lat = Number(query.lat);
    const lng = Number(query.lng);
    const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (googleKey) {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('latlng', `${lat},${lng}`);
      url.searchParams.set('key', googleKey);
      const res = await fetch(url);
      const json = (await res.json()) as {
        results?: Array<{ formatted_address?: string }>;
        status?: string;
      };
      const address = json.results?.[0]?.formatted_address ?? '';
      return { provider: 'google', lat, lng, address, placeLabel: address };
    }

    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MaherAghbarERP/1.0 (factory delivery)' },
    });
    const json = (await res.json()) as {
      display_name?: string;
      name?: string;
    };
    return {
      provider: 'nominatim',
      lat,
      lng,
      address: json.display_name ?? '',
      placeLabel: json.name ?? json.display_name ?? '',
    };
  }

  @Get('search')
  @RequirePermissions('delivery.read')
  async search(@Query() query: ForwardGeocodeQuery) {
    const googleKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
    if (googleKey) {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('address', query.q);
      if (query.country) url.searchParams.set('components', `country:${query.country}`);
      url.searchParams.set('key', googleKey);
      const res = await fetch(url);
      const json = (await res.json()) as {
        results?: Array<{
          formatted_address?: string;
          geometry?: { location?: { lat: number; lng: number } };
        }>;
      };
      return {
        provider: 'google',
        results: (json.results ?? []).slice(0, 5).map((r) => ({
          address: r.formatted_address ?? '',
          lat: r.geometry?.location?.lat ?? null,
          lng: r.geometry?.location?.lng ?? null,
        })),
      };
    }

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('q', query.q);
    url.searchParams.set('limit', '5');
    if (query.country) url.searchParams.set('countrycodes', query.country.toLowerCase());
    const res = await fetch(url, {
      headers: { 'User-Agent': 'MaherAghbarERP/1.0 (factory delivery)' },
    });
    const json = (await res.json()) as Array<{
      display_name?: string;
      lat?: string;
      lon?: string;
    }>;
    return {
      provider: 'nominatim',
      results: json.map((r) => ({
        address: r.display_name ?? '',
        lat: r.lat ? Number(r.lat) : null,
        lng: r.lon ? Number(r.lon) : null,
      })),
    };
  }
}
