// app/api/places/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { googlePlacesService } from '@/lib/services/google-places';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius');
  const type = searchParams.get('type');

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
    
    if (type) {
      options.type = type;
    }

    const results = await googlePlacesService.searchPlaces(query, options);
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Places search API error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}