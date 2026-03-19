import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import { RotateCw } from 'lucide-react';

const SYLLABLES = [
  'ma', 'da', 'ba', 'ta', 'la', 'ka', 'pa', 'ra', 'sa', 'za',
  'na', 'wa', 'fa', 'ga', 'ha', 'ja', 'ca'
];

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y', 'ą', 'ę', 'ó']);

interface TileData {
  id: string;
  leftSyllable: string;
  rightSyllable: string;
  rotation: number;
  x?: number;
  y?: number;
  isOnBoard: boolean;
  connectedTick?: number;
  hasBeenConnected?: boolean;
}

const generateRandomTile = (matchingSyllables?: string[]): TileData => {
  let s1 = SYLLABLES[Math.floor(Math.random() * SYLLABLES.length)];
  let s2 = SYLLABLES[Math.floor(Math.random() * SYLLABLES.length)];

  if (matchingSyllables && matchingSyllables.length > 0) {
    const match = matchingSyllables[Math.floor(Math.random() * matchingSyllables.length)];
    if (Math.random() > 0.5) {
      s1 = match;
    } else {
      s2 = match;
    }
  }

  return {
    id: Math.random().toString(36).substr(2, 9),
    leftSyllable: s1,
    rightSyllable: s2,
    rotation: 0,
    isOnBoard: false,
    hasBeenConnected: false,
  };
};

const getAvailableSyllables = (tiles: TileData[]): string[] => {
  const boardTiles = tiles.filter(t => t.isOnBoard && t.hasBeenConnected);
  if (boardTiles.length === 0) return [];

  const allSquares: { x: number, y: number, syl: string, tileId: string }[] = [];
  for (const t of boardTiles) {
     const rot = (t.rotation % 360 + 360) % 360;
     const rad = rot * Math.PI / 180;
     const cx = (t.x || 0) + 112;
     const cy = (t.y || 0) + 56;
     allSquares.push({
       x: Math.round(cx - 56 * Math.cos(rad)), 
       y: Math.round(cy - 56 * Math.sin(rad)), 
       syl: t.leftSyllable,
       tileId: t.id
     });
     allSquares.push({
       x: Math.round(cx + 56 * Math.cos(rad)), 
       y: Math.round(cy + 56 * Math.sin(rad)), 
       syl: t.rightSyllable,
       tileId: t.id
     });
  }

  const available: string[] = [];
  for (let i = 0; i < allSquares.length; i++) {
     const sq = allSquares[i];
     let isTaken = false;
     for (let j = 0; j < allSquares.length; j++) {
        if (i === j || sq.tileId === allSquares[j].tileId) continue;
        const dist = Math.abs(sq.x - allSquares[j].x) + Math.abs(sq.y - allSquares[j].y);
        if (dist > 100 && dist < 120) {
           isTaken = true;
           break;
        }
     }
     if (!isTaken) {
        available.push(sq.syl);
     }
  }
  return available;
};

const ColoredSyllable: React.FC<{ text: string }> = ({ text }) => {
  return (
    <>
      {text.split('').map((char, index) => {
        const isVowel = VOWELS.has(char.toLowerCase());
        const color = isVowel ? 'var(--tile-text-right)' : 'var(--tile-text-left)';
        return (
          <span key={index} style={{ color }}>
            {char}
          </span>
        );
      })}
    </>
  );
};

function App() {
  const [tiles, setTiles] = useState<TileData[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [glowId, setGlowId] = useState<string | null>(null);
  const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 });
  const [boardZoom, setBoardZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  
  useEffect(() => {
     const boardTiles = tiles.filter(t => t.isOnBoard && t.hasBeenConnected);
     const paletteTiles = tiles.filter(t => !t.isOnBoard);
     if (boardTiles.length > 0 && paletteTiles.length > 0) {
         const available = getAvailableSyllables(tiles);
         if (available.length > 0) {
             const hasMatch = paletteTiles.some(pt => available.includes(pt.leftSyllable) || available.includes(pt.rightSyllable));
             if (!hasMatch) {
                 setTiles(prev => {
                     const updated = [...prev];
                     const pIndex = updated.findIndex(t => !t.isOnBoard);
                     if (pIndex !== -1) {
                         updated[pIndex] = generateRandomTile(available);
                     }
                     return updated;
                 });
             }
         }
     }
  }, [tiles]);

  useEffect(() => {
    const handleResize = () => {
      // 1728 is the exact width of a 16-inch MacBook. By scaling rigidly against this,
      // all smaller screens (13", 14") will render proportionally 1:1 identical layouts.
      const scale = Math.min(1, window.innerWidth / 1728);
      document.documentElement.style.setProperty('--app-scale', scale.toString());
      (window as any).__appScale = scale;
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const scaleStr = document.documentElement.style.getPropertyValue('--app-scale') || '1';
      const appScale = parseFloat(scaleStr);
      
      const rect = el.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left) / appScale;
      const mouseY = (e.clientY - rect.top) / appScale;
      
      setBoardZoom(prevZoom => {
         const zoomFactor = Math.exp(-e.deltaY * 0.005);
         const newZoom = Math.max(0.3, Math.min(prevZoom * zoomFactor, 2.5));
         
         setBoardOffset(prevOffset => {
           const Wx = (mouseX - prevOffset.x) / prevZoom;
           const Wy = (mouseY - prevOffset.y) / prevZoom;
           
           return {
             x: mouseX - Wx * newZoom,
             y: mouseY - Wy * newZoom
           };
         });
         return newZoom;
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  
  const dragInfo = useRef({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    originWasBoard: false
  });

  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1 Starter tile on the board
    const starterTile = generateRandomTile();
    starterTile.isOnBoard = true;
    starterTile.x = Math.round((window.innerWidth / 2 - 112) / 56) * 56;
    starterTile.y = Math.round((Math.max(100, window.innerHeight / 3 - 56)) / 56) * 56;
    starterTile.connectedTick = Date.now();
    starterTile.hasBeenConnected = true;

    // 10 tiles in palette
    const initialTiles: TileData[] = [starterTile];
    for (let i = 0; i < 10; i++) {
       if (i < 3) {
         initialTiles.push(generateRandomTile([starterTile.leftSyllable, starterTile.rightSyllable]));
       } else {
         initialTiles.push(generateRandomTile());
       }
    }
    setTiles(initialTiles);
  }, []);

  const handlePointerDownBoard = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.tile')) return;
    if (e.button !== 0) return;
    
    const scale = (window as any).__appScale || 1;
    setIsPanning(true);
    dragInfo.current = {
      startX: e.clientX / scale,
      startY: e.clientY / scale,
      initialX: boardOffset.x,
      initialY: boardOffset.y,
      originWasBoard: false
    };
  };

  const handlePointerDownTile = (e: React.PointerEvent, id: string, isOnBoard: boolean) => {
    const tile = tiles.find(t => t.id === id);
    if (!tile) return;

    // If the tile is permanently connected, ignore dragging it and do NOT stop propagation
    // This allows clicking on a connected tile to pan the entire board instead!
    if (tile.hasBeenConnected) return;

    e.preventDefault(); 
    e.stopPropagation(); // prevent panning on board
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.rotate-btn')) return;

    setDraggingId(id);

    let initX = tile.x || 0;
    let initY = tile.y || 0;

    if (!isOnBoard && boardRef.current) {
      const scale = (window as any).__appScale || 1;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const boardRect = boardRef.current.getBoundingClientRect();
      initX = (((rect.left - boardRect.left) / scale) - boardOffset.x) / boardZoom;
      initY = (((rect.top - boardRect.top) / scale) - boardOffset.y) / boardZoom;
      
      setTiles(prev => prev.map(t => 
          t.id === id ? { ...t, isOnBoard: true, x: initX, y: initY } : t
      ));
    }

    const scale = (window as any).__appScale || 1;
    dragInfo.current = {
      startX: (e.clientX / scale) / boardZoom,
      startY: (e.clientY / scale) / boardZoom,
      initialX: initX,
      initialY: initY,
      originWasBoard: isOnBoard
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const scale = (window as any).__appScale || 1;
    
    if (isPanning) {
      const dx = (e.clientX / scale) - dragInfo.current.startX;
      const dy = (e.clientY / scale) - dragInfo.current.startY;
      setBoardOffset({
        x: dragInfo.current.initialX + dx,
        y: dragInfo.current.initialY + dy
      });
      return;
    }

    if (!draggingId) return;
    
    const dx = (e.clientX / scale) / boardZoom - dragInfo.current.startX;
    const dy = (e.clientY / scale) / boardZoom - dragInfo.current.startY;
    
    setTiles(prev => prev.map(t => {
      if (t.id === draggingId) {
        return {
          ...t,
          x: dragInfo.current.initialX + dx,
          y: dragInfo.current.initialY + dy,
        };
      }
      return t;
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (draggingId) {
      const draggedTile = tiles.find(t => t.id === draggingId);
      
      if (draggedTile && draggedTile.isOnBoard) {
        // Prevent dropping inside or over the palette area
        const palette = document.querySelector('.palette-container');
        const isOverPalette = palette && e.clientY > palette.getBoundingClientRect().top;

        const rot = (draggedTile.rotation % 360 + 360) % 360;
        const rad = rot * Math.PI / 180;
        
        const snappedX = Math.round((draggedTile.x || 0) / 56) * 56;
        const snappedY = Math.round((draggedTile.y || 0) / 56) * 56;

        const cx = snappedX + 112; 
        const cy = snappedY + 56;
        
        const A_sq1 = { x: Math.round(cx - 56 * Math.cos(rad)), y: Math.round(cy - 56 * Math.sin(rad)), syl: draggedTile.leftSyllable };
        const A_sq2 = { x: Math.round(cx + 56 * Math.cos(rad)), y: Math.round(cy + 56 * Math.sin(rad)), syl: draggedTile.rightSyllable };

        const otherTiles = tiles.filter(t => t.isOnBoard && t.id !== draggingId);

        const allBoardSquares: { x: number, y: number, syl: string, tileId: string }[] = [];
        for (const t of otherTiles) {
           const trot = (t.rotation % 360 + 360) % 360;
           const trad = trot * Math.PI / 180;
           const tcx = (t.x || 0) + 112;
           const tcy = (t.y || 0) + 56;
           allBoardSquares.push({
             x: Math.round(tcx - 56 * Math.cos(trad)), 
             y: Math.round(tcy - 56 * Math.sin(trad)), 
             syl: t.leftSyllable,
             tileId: t.id
           });
           allBoardSquares.push({
             x: Math.round(tcx + 56 * Math.cos(trad)), 
             y: Math.round(tcy + 56 * Math.sin(trad)), 
             syl: t.rightSyllable,
             tileId: t.id
           });
        }

        let isOverlapping = false;
        let validConnections = 0;
        let invalidConnections = 0;

        for (const Asq of [A_sq1, A_sq2]) {
           for (const Bsq of allBoardSquares) {
              const dist = Math.abs(Asq.x - Bsq.x) + Math.abs(Asq.y - Bsq.y);
              if (dist < 10) {
                 isOverlapping = true;
              } else if (dist > 100 && dist < 120) {
                 // Touching!
                 if (Asq.syl !== Bsq.syl) {
                    invalidConnections++;
                 } else {
                    let bSqIsTaken = false;
                    for (const Csq of allBoardSquares) {
                       if (Csq.tileId === Bsq.tileId) continue;
                       const cDist = Math.abs(Bsq.x - Csq.x) + Math.abs(Bsq.y - Csq.y);
                       if (cDist > 100 && cDist < 120) {
                          bSqIsTaken = true;
                          break;
                       }
                    }

                    if (bSqIsTaken) {
                       invalidConnections++;
                    } else {
                       validConnections++;
                    }
                 }
              }
           }
        }

        let isValid = !isOverlapping && invalidConnections === 0 && !isOverPalette;
        let hasNeighbor = validConnections > 0;

        if (otherTiles.length === 0 && !isOverPalette) {
            isValid = true;
            hasNeighbor = true; // Starter case
        }

        if (isValid && hasNeighbor) {
          // ACCEPT CONNECTION
          setGlowId(draggingId);
          setTimeout(() => setGlowId(null), 600); 

          setTiles(prev => {
            let updated = prev.map(t => 
              t.id === draggingId ? { ...t, x: snappedX, y: snappedY, connectedTick: Date.now(), hasBeenConnected: true } : t
            );

            // Replenish palette if it wasn't connected before!
            if (!draggedTile.hasBeenConnected) {
              const available = getAvailableSyllables(updated);
              const newPaletteTile = generateRandomTile(available);
              updated = [...updated, newPaletteTile];
            }
            return updated;
          });
        } else if (isValid && !hasNeighbor) {
          // FREE PLACEMENT (No connection made, just dropped freely on the board)
          setTiles(prev => prev.map(t => 
            t.id === draggingId ? { ...t, x: snappedX, y: snappedY } : t
          ));
        } else {
          // REJECT (Overlap or Mismatch)
          setTiles(prev => prev.map(t => {
            if (t.id === draggingId) {
              if (isOverPalette && !t.hasBeenConnected) {
                // User dragged the free-floating tile back to the palette zone
                return { ...t, isOnBoard: false, x: undefined, y: undefined };
              } else if (dragInfo.current.originWasBoard) {
                // Return to original board position
                return { ...t, x: dragInfo.current.initialX, y: dragInfo.current.initialY };
              } else {
                // Return to palette
                return { ...t, isOnBoard: false, x: undefined, y: undefined };
              }
            }
            return t;
          }));
        }
      }
      setDraggingId(null);
    }
  };

  const handleDoubleClickTile = (id: string, isOnBoard: boolean, hasBeenConnected: boolean) => {
    if (isOnBoard && !hasBeenConnected) {
      setTiles(prev => prev.map(t => 
        t.id === id ? { ...t, isOnBoard: false, x: undefined, y: undefined } : t
      ));
    }
  };

  const rotateTile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    setTiles(prev => prev.map(t => {
      if (t.id === id) {
        return { ...t, rotation: t.rotation + 90 };
      }
      return t;
    }));
  };

  return (
    <div 
      className="app-container" 
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div className="header">
        <h1 className="title">Sylabo Domino z Dzieszkoła.pl</h1>
        <div style={{pointerEvents: 'auto', display: 'flex', gap: '1rem'}}>
          <button 
            style={{padding: '0.75rem 1.5rem', fontSize: '1.2rem', borderRadius: '12px', border: '1px solid var(--palette-border)', background: 'var(--palette-bg)', color: '#fff', cursor: 'pointer', fontWeight: 600}}
            onClick={() => {
              const onBoardTiles = tiles.filter(t => t.isOnBoard);
              const available = getAvailableSyllables(tiles);
              
              const newPaletteTiles = Array.from({ length: 10 }).map((_, i) => {
                if (i < 5 && available.length > 0) {
                  return generateRandomTile(available);
                }
                return generateRandomTile();
              });
              
              setTiles([...onBoardTiles, ...newPaletteTiles]);
            }}
          >
            Odśwież Opcje
          </button>
        </div>
      </div>

      <div 
        className="board-area" 
        ref={boardRef}
        onPointerDown={handlePointerDownBoard}
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest('.tile')) return;
          setBoardZoom(1);
          setBoardOffset({ x: 0, y: 0 });
        }}
        style={{ 
          cursor: isPanning ? 'grabbing' : 'grab',
          backgroundPosition: `${boardOffset.x}px ${boardOffset.y}px`,
          backgroundSize: `${56 * boardZoom}px ${56 * boardZoom}px`
        }}
      >
        <div style={{ transform: `translate(${boardOffset.x}px, ${boardOffset.y}px) scale(${boardZoom})`, transformOrigin: '0 0', width: '100%', height: '100%', position: 'absolute', pointerEvents: 'none' }}>
          {tiles.filter(t => t.isOnBoard).map(tile => {
             let classes = `tile on-board`;
             if (draggingId === tile.id) classes += ' is-dragging';
             if (glowId === tile.id) classes += ' glow-success';

             return (
              <div
                key={tile.id}
                className={classes}
                style={{
                  left: tile.x,
                  top: tile.y,
                  transform: `rotate(${tile.rotation}deg) ${draggingId === tile.id ? 'scale(1.05)' : ''}`,
                  zIndex: draggingId === tile.id ? 100 : 10
                }}
                onPointerDown={(e) => handlePointerDownTile(e, tile.id, true)}
                onDoubleClick={() => handleDoubleClickTile(tile.id, tile.isOnBoard, !!tile.hasBeenConnected)}
              >
                 <div className="tile-part left">
                   <div style={{ transform: `rotate(${-tile.rotation}deg)`, transition: 'transform 0.2s' }}>
                     <ColoredSyllable text={tile.leftSyllable} />
                   </div>
                 </div>
                 <div className="tile-part right">
                   <div style={{ transform: `rotate(${-tile.rotation}deg)`, transition: 'transform 0.2s' }}>
                     <ColoredSyllable text={tile.rightSyllable} />
                   </div>
                 </div>
                 
                 {(!draggingId && !tile.hasBeenConnected) && (
                   <button 
                    className="rotate-btn" 
                    onClick={(e) => rotateTile(tile.id, e)}
                    style={{ transform: `rotate(${-tile.rotation}deg)` }} 
                   >
                     <RotateCw size={28} />
                   </button>
                 )}
              </div>
             );
          })}
        </div>
      </div>

      <div className="palette-container">
        <div className="palette-glass glass">
          {tiles.filter(t => !t.isOnBoard).map(tile => (
            <div key={tile.id} className="tile-wrapper">
              <div
                className={`tile ${draggingId === tile.id ? 'is-dragging' : ''}`}
                onPointerDown={(e) => handlePointerDownTile(e, tile.id, false)}
                style={{ transform: draggingId === tile.id ? 'scale(1.05)' : 'none' }}
              >
                <div className="tile-part left"><ColoredSyllable text={tile.leftSyllable} /></div>
                <div className="tile-part right"><ColoredSyllable text={tile.rightSyllable} /></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
