import { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import type { TreeData, TreePerson, LayoutNode, LayoutEdge } from '../../types';
import { computeLayout, NODE_W, NODE_H } from './treeLayout';
import { thumbnailUrl } from '../../api/client';

interface FamilyTreeProps {
  data: TreeData;
  onSelectPerson: (id: string) => void;
  highlightId?: string;
}

const GENDER_COLORS: Record<string, string> = {
  male: '#dbeafe',
  female: '#fce7f3',
  other: '#e8d5ff',
  unknown: '#f3f4f6',
};

const GENDER_BORDER: Record<string, string> = {
  male: '#93c5fd',
  female: '#f9a8d4',
  other: '#c4b5fd',
  unknown: '#d1d5db',
};

function formatYears(p: TreePerson): string {
  const b = p.birthDate ? p.birthDate.slice(0, 4) : '?';
  const d = p.deathDate ? p.deathDate.slice(0, 4) : '';
  return d ? `${b} – ${d}` : p.birthDate ? `b. ${b}` : '';
}

export default function FamilyTree({ data, onSelectPerson, highlightId }: FamilyTreeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);

  const render = useCallback(() => {
    const svg = d3.select(svgRef.current!);
    const g = d3.select(gRef.current!);

    const { nodes, edges } = computeLayout(data.persons);

    if (nodes.length === 0) {
      g.selectAll('*').remove();
      return;
    }

    const allX = nodes.map((n) => n.x);
    const allY = nodes.map((n) => n.y);
    const minX = Math.min(...allX) - 60;
    const minY = Math.min(...allY) - 60;
    const maxX = Math.max(...allX) + NODE_W + 60;
    const maxY = Math.max(...allY) + NODE_H + 60;
    const contentW = maxX - minX;
    const contentH = maxY - minY;

    // Set up zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString());
      });

    svg.call(zoom);

    // Initial fit
    const svgEl = svgRef.current!;
    const vw = svgEl.clientWidth || 900;
    const vh = svgEl.clientHeight || 600;
    const scale = Math.min(vw / contentW, vh / contentH, 1);
    const tx = (vw - contentW * scale) / 2 - minX * scale;
    const ty = (vh - contentH * scale) / 2 - minY * scale;
    svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

    g.selectAll('*').remove();

    // ── Draw parent-child edges ──
    const parentEdges = edges.filter((e) => e.type === 'parent-child');
    g.selectAll<SVGPathElement, LayoutEdge>('.edge-parent')
      .data(parentEdges, (d) => `${d.fromId}>${d.toId}`)
      .join('path')
      .attr('class', 'edge-parent')
      .attr('fill', 'none')
      .attr('stroke', '#9ca3af')
      .attr('stroke-width', 2)
      .attr('d', (d) => {
        const midY = (d.y1 + d.y2) / 2;
        return `M${d.x1},${d.y1} C${d.x1},${midY} ${d.x2},${midY} ${d.x2},${d.y2}`;
      });

    // ── Draw spouse edges ──
    const spouseEdges = edges.filter((e) => e.type === 'spouse');
    g.selectAll<SVGLineElement, LayoutEdge>('.edge-spouse')
      .data(spouseEdges, (d) => `${d.fromId}<>${d.toId}`)
      .join('line')
      .attr('class', 'edge-spouse')
      .attr('x1', (d) => d.x1)
      .attr('y1', (d) => d.y1)
      .attr('x2', (d) => d.x2)
      .attr('y2', (d) => d.y2)
      .attr('stroke', '#f9a8d4')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6,3');

    // ── Draw person nodes ──
    const nodeGroups = g
      .selectAll<SVGGElement, LayoutNode>('.person-node')
      .data(nodes, (d) => d.person.id)
      .join('g')
      .attr('class', 'person-node')
      .attr('transform', (d) => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (_event, d) => onSelectPerson(d.person.id));

    // Card shadow + border
    nodeGroups
      .append('rect')
      .attr('x', 3)
      .attr('y', 3)
      .attr('width', NODE_W)
      .attr('height', NODE_H)
      .attr('rx', 10)
      .attr('fill', 'rgba(0,0,0,0.12)');

    nodeGroups
      .append('rect')
      .attr('width', NODE_W)
      .attr('height', NODE_H)
      .attr('rx', 10)
      .attr('fill', (d) => GENDER_COLORS[d.person.gender] ?? '#f3f4f6')
      .attr('stroke', (d) =>
        d.person.id === highlightId ? '#f59e0b' : GENDER_BORDER[d.person.gender] ?? '#d1d5db'
      )
      .attr('stroke-width', (d) => (d.person.id === highlightId ? 3 : 1.5));

    // Profile photo clip + circle
    nodeGroups.each(function (d) {
      const grp = d3.select(this);
      const hasPhoto = !!d.person.profilePhotoId;

      if (hasPhoto) {
        const clipId = `clip-${d.person.id}`;
        grp
          .append('clipPath')
          .attr('id', clipId)
          .append('circle')
          .attr('cx', 34)
          .attr('cy', NODE_H / 2)
          .attr('r', 26);

        grp
          .append('image')
          .attr('href', thumbnailUrl(d.person.profilePhotoId!))
          .attr('x', 8)
          .attr('y', NODE_H / 2 - 26)
          .attr('width', 52)
          .attr('height', 52)
          .attr('clip-path', `url(#${clipId})`);
      } else {
        // Gender icon placeholder
        grp
          .append('circle')
          .attr('cx', 34)
          .attr('cy', NODE_H / 2)
          .attr('r', 24)
          .attr('fill', 'white')
          .attr('opacity', 0.6);

        const icon = d.person.gender === 'male' ? '♂' : d.person.gender === 'female' ? '♀' : '⊕';
        grp
          .append('text')
          .attr('x', 34)
          .attr('y', NODE_H / 2 + 6)
          .attr('text-anchor', 'middle')
          .attr('font-size', 18)
          .attr('fill', GENDER_BORDER[d.person.gender] ?? '#6b7280')
          .text(icon);
      }
    });

    // Name text
    nodeGroups
      .append('text')
      .attr('x', 70)
      .attr('y', NODE_H / 2 - 8)
      .attr('font-size', 13)
      .attr('font-weight', '600')
      .attr('fill', '#1f2937')
      .attr('font-family', 'Inter, sans-serif')
      .text((d) => {
        const full = `${d.person.firstName} ${d.person.lastName}`;
        return full.length > 14 ? full.slice(0, 13) + '…' : full;
      });

    // Years text
    nodeGroups
      .append('text')
      .attr('x', 70)
      .attr('y', NODE_H / 2 + 10)
      .attr('font-size', 11)
      .attr('fill', '#6b7280')
      .attr('font-family', 'Inter, sans-serif')
      .text((d) => formatYears(d.person));

    // Occupation text
    nodeGroups
      .append('text')
      .attr('x', 70)
      .attr('y', NODE_H / 2 + 25)
      .attr('font-size', 10)
      .attr('fill', '#9ca3af')
      .attr('font-family', 'Inter, sans-serif')
      .text((d) => {
        const occ = d.person.occupation ?? '';
        return occ.length > 16 ? occ.slice(0, 15) + '…' : occ;
      });

    // Hover highlight
    nodeGroups
      .on('mouseenter', function () {
        d3.select(this).select('rect:nth-of-type(2)').attr('stroke-width', 3);
      })
      .on('mouseleave', function (_, d) {
        d3.select(this)
          .select('rect:nth-of-type(2)')
          .attr('stroke-width', d.person.id === highlightId ? 3 : 1.5);
      });
  }, [data, onSelectPerson, highlightId]);

  useEffect(() => {
    render();
  }, [render]);

  // Re-render on window resize
  useEffect(() => {
    const observer = new ResizeObserver(() => render());
    if (svgRef.current) observer.observe(svgRef.current);
    return () => observer.disconnect();
  }, [render]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ background: 'transparent' }}
    >
      <g ref={gRef} />
    </svg>
  );
}
