// app/api/places/autocomplete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { googlePlacesService } from '@/lib/services/google-places';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  try {
    const options: any = {};
    
    if (lat && lng) {
      options.location = { lat: parseFloat(lat), lng: parseFloat(lng) };
    }
    
    if (radius) {
      options.radius = parseInt(radius);
    }

    const results = await googlePlacesService.getAddressSuggestions(query, options);
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Places autocomplete API error:', error);
    return NextResponse.json({ error: 'Autocomplete failed' }, { status: 500 });
  }
}