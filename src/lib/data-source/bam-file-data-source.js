/*
 * Copyright (c) 2015 Satoshi Tada (Dynacom, Co.,Ltd.)
 *
 * JS Common Libs is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * JS Common Libs is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with JS Common Libs. If not, see <http://www.gnu.org/licenses/>.
 */


function BamFileDataSource(args) {
    DataSource.call(this, args);

    _.extend(this, Backbone.Events);

    this.baifile;
    this.bamfile;
    this.async = true;
    this.maxSize = 500 * 1024 * 1024;
    this.type = 'binary';
    this.suppressErrors = false;

    //set instantiation args, must be last
    _.extend(this, args);
};

BamFileDataSource.prototype = new DataSource();

_.extend(BamFileDataSource.prototype, {
    BAM_MAGIC: 0x14d4142,
    BAI_MAGIC: 0x1494142,
    BamFlags: {
        MULTIPLE_SEGMENTS:       0x1,
        ALL_SEGMENTS_ALIGN:      0x2,
        SEGMENT_UNMAPPED:        0x4,
        NEXT_SEGMENT_UNMAPPED:   0x8,
        REVERSE_COMPLEMENT:      0x10,
        NEXT_REVERSE_COMPLEMENT: 0x20,
        FIRST_SEGMENT:           0x40,
        LAST_SEGMENT:            0x80,
        SECONDARY_ALIGNMENT:     0x100,
        QC_FAIL:                 0x200,
        DUPLICATE:               0x400,
        SUPPLEMENTARY:           0x800
    },

    error: function (msg) {
        var e2w = this.suppressErrors;
        this.trigger('error', { message: msg, sender: this, suppress: e2w });
        if (e2w) {
            console.warn(msg);
        } else {
            console.error(msg);
        }
    },

    fetch: function () {
        DataSource.prototype.fetch.call(this);

        var _this = this;

        if (!this.baifile) {
            this.error("Bam index file(bai) is not specified.");
            return;
        }

        if (!this.bamfile) {
            this.error("Bam file(bam) is not specified.");
            return;
        }

        if (this.baifile.size > this.maxSize) {
            this.error("File is too big. Max file size is " + this.maxSize + " bytes.");
            return;
        }


        if (this.async) {
            var reader = new FileReader();
            reader.onprogress = function(evt) {
                _this.trigger('progress', {
                    originalEvent: evt, sender: _this
                });
            };
            reader.onload = function (evt) {
                _this.baidata = { raw: evt.target.result };
                _.extend(_this.baidata, _this._parseBai(_this.baidata.raw) || {});
                _this.trigger('bailoaded', {
                    baidata: _this.baidata, result: evt.target.result,
                    originalEvent: evt, sender: _this
                });

                var bamblob = _this.bamfile.slice(0, _this.baidata.minBlockIndex),
                    bamreader = new FileReader();
                bamreader.onload = function (evt) {
                    _this.bamheader = {};
                    _this._parseBamHeader(evt.target.result);
                };
                bamreader.readAsArrayBuffer(bamblob);
            };
            return this.readAs(this.type, reader, this.baifile);
        } else {
            // FileReaderSync web workers only
            var reader = new FileReaderSync(),
                result = this.readAs(this.type, reader, this.baifile);
            this.baidata = { raw: result };
            _.extend(this.baidata, this._parseBai(this.baidata.raw) || {});
            this.trigger('bailoaded', {
                baidata: this.baidata, result: result,
                originalEvent: undefined, sender: this
            });

            var bamblob = this.bamfile.slice(0, this.baidata.minBlockIndex);
            this.bamheader = {};
            this._parseBamHeader(reader.readAsArrayBuffer(bamblob));
            return this;
        }
    },

    readAs: function (type, reader, file) {
        switch (type) {
            case 'binary':
                return reader.readAsBinaryString(file);
                break;
            case 'text':
            default:
                return reader.readAsText(file, "UTF-8");
        }
    },

    _parseBai: function (data) {
        // code from biodalliance
        var header = bstringToBuffer(data);
        var uncba = new Uint8Array(header);
        var baiMagic = readInt(uncba, 0);
        if (baiMagic != this.BAI_MAGIC) {
            this.error('Not a BAI file, magic=0x' + baiMagic.toString(16));
            return;
        }

        var minBlockIndex = 1000000000;
        var nref = readInt(uncba, 4);
        var indices = [];

        var p = 8;
        for (var ref = 0; ref < nref; ++ref) {
            var blockStart = p;
            var o = this._getBaiRefLength(uncba, blockStart);
            p += o.length;

            minBlockIndex = Math.min(o.minBlockIndex, minBlockIndex);

            var nbin = o.nbin;
            if (nbin > 0) {
                indices[ref] = new Uint8Array(header, blockStart, p - blockStart);
            }
        }

        return { indices: indices, minBlockIndex: minBlockIndex };
    },


    // Calculate the length (in bytes) of the BAI ref starting at offset.
    // Returns {nbin, length, minBlockIndex}
    _getBaiRefLength: function (uncba, offset) {
        var p = offset;
        var nbin = readInt(uncba, p); p += 4;

        for (var b = 0; b < nbin; ++b) {
            var bin = readInt(uncba, p);
            var nchnk = readInt(uncba, p + 4);
            p += 8 + (nchnk * 16);
        }

        var nintv = readInt(uncba, p); p += 4;
        var minBlockIndex = 1000000000;
        var q = p;

        for (var i = 0; i < nintv; ++i) {
            var v = readVob(uncba, q); q += 8;
            if (v) {
                var bi = v.block;
                if (v.offset > 0)
                    bi += 65536;

                minBlockIndex = Math.min(bi, minBlockIndex);
                break;
            }
        }
        p += (nintv * 8);

        return {
            minBlockIndex: minBlockIndex,
            nbin: nbin,
            length: p - offset
        };
    },

    // Fills out bam.chrToIndex and bam.indexToChr based on the first few bytes of the BAM.
    _parseBamHeader: function(data) {
        if (!data) {
            this.error("Couldn't access BAM");
            return;
        }

        var unc = unbgzf(data, data.byteLength),
            uncba = new Uint8Array(unc);

        var magic = readInt(uncba, 0);
        if (magic != this.BAM_MAGIC) {
            this.error("Not a BAM file, magic=0x" + magic.toString(16));
            return;
        }

        var headLen = readInt(uncba, 4),
            header = String.fromCharCode.apply("",
                         Array.prototype.slice.call(uncba, 8, 7 + headLen)),
            nRef = readInt(uncba, headLen + 8),
            p = headLen + 12;

        console.log("Loading bam header:", headLen, "\n", header);
        var bamheader = { header_text: header, chrToIndex: {}, indexToChr: [], refLength: [] };
        for (var i = 0; i < nRef; ++i) {
            var lName = readInt(uncba, p), lno = p + 4,
                lRef = readInt(uncba, lno + lName),
                name = String.fromCharCode.apply("",
                           Array.prototype.slice.call(uncba, lno, lno + lName - 1));

            bamheader.chrToIndex[name] = i;
            if (/^chr/.test(name)) {
                bamheader.chrToIndex[name.substring(3)] = i;
            } else {
                bamheader.chrToIndex['chr' + name] = i;
            }
            bamheader.indexToChr.push(name);
            bamheader.refLength.push(lRef);

            p = lno + lName + 4;
        }

        this.bamheader = bamheader;
        this.trigger('bamready', { bamheader: bamheader, sender: this });
        return bamheader;
    },


    _blocksForRange: function(refId, min, max) {
        var index = this.baidata.indices[refId];
        if (!index) {
            return [];
        }

        var intBinsL = reg2bins(min, max);
        var intBins = [];
        for (var i = 0; i < intBinsL.length; ++i) {
            intBins[intBinsL[i]] = true;
        }
        var leafChunks = [], otherChunks = [];

        var nbin = readInt(index, 0);
        var p = 4;
        for (var b = 0; b < nbin; ++b) {
            var bin = readInt(index, p);
            var nchnk = readInt(index, p+4);
            p += 8;
            if (intBins[bin]) {
                for (var c = 0; c < nchnk; ++c) {
                    var cs = readVob(index, p);
                    var ce = readVob(index, p + 8);
                    (bin < 4681 ? otherChunks : leafChunks).push(new Chunk(cs, ce));
                    p += 16;
                }
            } else {
                p +=  (nchnk * 16);
            }
        }

        var nintv = readInt(index, p);
        var lowest = null;
        var minLin = Math.min(min>>14, nintv - 1), maxLin = Math.min(max>>14, nintv - 1);
        for (var i = minLin; i <= maxLin; ++i) {
            var lb =  readVob(index, p + 4 + (i * 8));
            if (!lb) {
                continue;
            }
            if (!lowest || lb.block < lowest.block || lb.offset < lowest.offset) {
                lowest = lb;
            }
        }
        
        var prunedOtherChunks = [];
        if (lowest != null) {
            for (var i = 0; i < otherChunks.length; ++i) {
                var chnk = otherChunks[i];
                if (chnk.maxv.block >= lowest.block && chnk.maxv.offset >= lowest.offset) {
                    prunedOtherChunks.push(chnk);
                }
            }
        }
        otherChunks = prunedOtherChunks;

        var intChunks = [];
        for (var i = 0; i < otherChunks.length; ++i) {
            intChunks.push(otherChunks[i]);
        }
        for (var i = 0; i < leafChunks.length; ++i) {
            intChunks.push(leafChunks[i]);
        }

        intChunks.sort(function(c0, c1) {
            var dif = c0.minv.block - c1.minv.block;
            if (dif != 0) {
                return dif;
            } else {
                return c0.minv.offset - c1.minv.offset;
            }
        });
        var mergedChunks = [];
        if (intChunks.length > 0) {
            var cur = intChunks[0];
            for (var i = 1; i < intChunks.length; ++i) {
                var nc = intChunks[i];
                if (nc.minv.block == cur.maxv.block /* && nc.minv.offset == cur.maxv.offset */) { // no point splitting mid-block
                    cur = new Chunk(cur.minv, nc.maxv);
                } else {
                    mergedChunks.push(cur);
                    cur = nc;
                }
            }
            mergedChunks.push(cur);
        }

        return mergedChunks;
    },

    collectReads: function(chr, min, max, opts) {
        var _this = this;
        opts = opts || {};

        var timeId = "bam read load " + Utils.randomString(4);
        console.time(timeId);

        var chrId = this.bamheader.chrToIndex[chr];
        var chunks;
        if (chrId == undefined) {
            chunks = [];
        } else {
            chunks = this._blocksForRange(chrId, min, max);
            if (!chunks) {
                this.error('Error in index fetch');
            }
        }
        // if (chunks.length == 0) {
        //     console.warn("No chunks to collect reads.", chr, min, max);
        // }


        opts.segment2chrom = function (reads) {
            // set read.chromosome from read.segment
            var aliasmap = _this.bamheader.aliasmap;
            reads.forEach(function(r) {
                r.chromosome = aliasmap[r.segment];
                if (r.mateSegment) {
                    r.mateReferenceName = aliasmap[r.mateSegment];
                }
            });
            return reads;
        };

        var loadedRecords = [], stopLoading = false;

        function loadBamreads(index, data) {
            var ba = new Uint8Array(data), records = [];
            if (_this.readBamRecords(ba, chunks[index].minv.offset, records,
                                     min, max, chrId, opts)) {
                // load finished
                stopLoading = true;
            }
            return records;
        }

        function loadBamdata(index) {
            var ch = chunks[index],
                fetchMin = ch.minv.block,
                fetchMax = ch.maxv.block + (1 << 16),
                bamblob = _this.bamfile.slice(fetchMin, fetchMax),
                bamreader = new FileReader();

            // console.log("loadBamdata", fetchMin, fetchMax, fetchMax - fetchMin);
            bamreader.onload = function (evt) {
                data = unbgzf(evt.target.result, ch.maxv.block - ch.minv.block + 1);
                var records = loadBamreads(index, data);
                loadedRecords = loadedRecords.concat(records);

                console.log("Loaded reads:", records.length, "at chunk", index);
                if (stopLoading) {
                    // exit from loading chunks
                    startLoading(chunks.length);
                } else {
                    // load next chunk
                    startLoading(++index);
                }
            };
            bamreader.readAsArrayBuffer(bamblob);
        }

        function startLoading(index) {
            if (index >= chunks.length) {
                console.timeEnd(timeId);

                _this.trigger('bamreadloaded', {
                    region: new Region({ chromosome: chr, start: min, end: max }),
                    reads: loadedRecords, sender: _this
                });

                if (_.isFunction(opts.callback)) {
                    opts.callback(loadedRecords);
                }

                return;
            }
            loadBamdata(index);
        }

        startLoading(0);
    },

    readBamRecords: readBamRecords,

    region: function(args) {
        // interface for BamAdapter.getData()
        var _this = this,
            regions_id = args.region;
        if (_.isString(regions_id)) { regions_id = regions_id.split(","); }

        regions_id.forEach(function(r) {
            var range = r.split(/[:\-]/g),
                response = { id: r, result: [] },
                sendres = function(records) {
                    response.result = {
                        start: range[1], end: range[2], reads: records
                    };
                    args.success({ response: [ response ] });
                };
            _this.collectReads(range[0], range[1], range[2], { callback: sendres });
        });
    },
});

// ======================

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// lh3utils.js: common support for lh3's file formats
//

function Vob(b, o) {
    this.block = b;
    this.offset = o;
}

Vob.prototype.toString = function() {
    return '' + this.block + ':' + this.offset;
}

function readVob(ba, offset, allowZero) {
    var block = ((ba[offset+6] & 0xff) * 0x100000000) +
                ((ba[offset+5] & 0xff) * 0x1000000) +
                ((ba[offset+4] & 0xff) * 0x10000) +
                ((ba[offset+3] & 0xff) * 0x100) +
                ((ba[offset+2] & 0xff));
    var bint = (ba[offset+1] << 8) | (ba[offset]);
    if (block == 0 && bint == 0 && !allowZero) {
        return null;  // Should only happen in the linear index?
    } else {
        return new Vob(block, bint);
    }
}

function unbgzf(data, lim) {
    lim = Math.min(lim || 1, data.byteLength - 50);
    var oBlockList = [];
    var ptr = [0];
    var totalSize = 0;

    while (ptr[0] < lim) {
        var ba = new Uint8Array(data, ptr[0], 12); // FIXME is this enough for all credible BGZF block headers?
        var xlen = (ba[11] << 8) | (ba[10]);
        var unc = jszlib_inflate_buffer(data, 12 + xlen + ptr[0],
                    Math.min(65536, data.byteLength - 12 - xlen - ptr[0]), ptr);
        ptr[0] += 8;
        totalSize += unc.byteLength;
        oBlockList.push(unc);
    }

    if (oBlockList.length == 1) {
        return oBlockList[0];
    } else {
        var out = new Uint8Array(totalSize);
        var cursor = 0;
        for (var i = 0; i < oBlockList.length; ++i) {
            var b = new Uint8Array(oBlockList[i]);
            arrayCopy(b, 0, out, cursor, b.length);
            cursor += b.length;
        }
        return out.buffer;
    }
}

function Chunk(minv, maxv) {
    this.minv = minv; this.maxv = maxv;
}

//
// Binning (transliterated from SAM1.3 spec)
//

/* calculate bin given an alignment covering [beg,end) (zero-based, half-close-half-open) */
function reg2bin(beg, end)
{
    --end;
    if (beg>>14 == end>>14) return ((1<<15)-1)/7 + (beg>>14);
    if (beg>>17 == end>>17) return ((1<<12)-1)/7 + (beg>>17);
    if (beg>>20 == end>>20) return ((1<<9)-1)/7 + (beg>>20);
    if (beg>>23 == end>>23) return ((1<<6)-1)/7 + (beg>>23);
    if (beg>>26 == end>>26) return ((1<<3)-1)/7 + (beg>>26);
    return 0;
}

/* calculate the list of bins that may overlap with region [beg,end) (zero-based) */
var MAX_BIN = (((1<<18)-1)/7);
function reg2bins(beg, end) 
{
    var i = 0, k, list = [];
    --end;
    list.push(0);
    for (k = 1 + (beg>>26); k <= 1 + (end>>26); ++k) list.push(k);
    for (k = 9 + (beg>>23); k <= 9 + (end>>23); ++k) list.push(k);
    for (k = 73 + (beg>>20); k <= 73 + (end>>20); ++k) list.push(k);
    for (k = 585 + (beg>>17); k <= 585 + (end>>17); ++k) list.push(k);
    for (k = 4681 + (beg>>14); k <= 4681 + (end>>14); ++k) list.push(k);
    return list;
}

// ======================

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// bin.js general binary data support
//

function bstringToBuffer(result) {
    if (!result) {
        return null;
    }

    var ba = new Uint8Array(result.length);
    for (var i = 0; i < ba.length; ++i) {
        ba[i] = result.charCodeAt(i);
    }
    return ba.buffer;
}

// Read from Uint8Array

(function(global) {
    var convertBuffer = new ArrayBuffer(8);
    var ba = new Uint8Array(convertBuffer);
    var fa = new Float32Array(convertBuffer);

    global.readFloat = function(buf, offset) {
        ba[0] = buf[offset];
        ba[1] = buf[offset+1];
        ba[2] = buf[offset+2];
        ba[3] = buf[offset+3];
        return fa[0];
    };
 }(this));

function readInt64(ba, offset) {
    return (ba[offset + 7] << 24) | (ba[offset + 6] << 16) | (ba[offset + 5] << 8) | (ba[offset + 4]);
}

function readInt(ba, offset) {
    return (ba[offset + 3] << 24) | (ba[offset + 2] << 16) | (ba[offset + 1] << 8) | (ba[offset]);
}

function readShort(ba, offset) {
    return (ba[offset + 1] << 8) | (ba[offset]);
}

function readByte(ba, offset) {
    return ba[offset];
}

function readIntBE(ba, offset) {
    return (ba[offset] << 24) | (ba[offset + 1] << 16) | (ba[offset + 2] << 8) | (ba[offset + 3]);
}

// ======================

// 
// Dalliance Genome Explorer
// (c) Thomas Down 2006-2011
//
// bam.js: indexed binary alignments
//

function BamRecord() {
}

BamRecord.prototype = {
    // ['=', 'A', 'C', 'x', 'G', 'x', 'x', 'x', 'T', 'x', 'x', 'x', 'x', 'x', 'x', 'N'],
    SEQRET_DECODER: "=ACMGRSVTWYHKDBN".split(''),
    // ['M', 'I', 'D', 'N', 'S', 'H', 'P', '=', 'X', '?', '?', '?', '?', '?', '?', '?']
    CIGAR_DECODER: "MIDNSHP=X???????".split(''),
};

function readBamRecords(ba, offset, sink, min, max, chrId, opts) {
    while (true) {
        var blockSize = readInt(ba, offset);
        var blockEnd = offset + blockSize + 4;
        if (blockEnd >= ba.length) {
            return false;
        }

        var record = new BamRecord();

        var refID = readInt(ba, offset + 4);
        var pos = readInt(ba, offset + 8) + 1;
        
        var bmn = readInt(ba, offset + 12);
        var bin = (bmn & 0xffff0000) >> 16;
        var mq = (bmn & 0xff00) >> 8;
        var nl = bmn & 0xff;

        var flag_nc = readInt(ba, offset + 16);
        var flag = (flag_nc & 0xffff0000) >> 16;
        var nc = flag_nc & 0xffff;

        var lseq = readInt(ba, offset + 20);

        var nextRef  = readInt(ba, offset + 24);
        var nextPos = readInt(ba, offset + 28) + 1;

        var tlen = readInt(ba, offset + 32);

        record.segment = refID; // this.indexToChr[refID];
        record.flags = flag;
        record.start = pos;
        record.mappingQuality = mq;
        record.readLength = lseq;
        record.blocks = lseq; // fix after
        record.end = pos + lseq; // fix after
        record.unclippedStart = pos; // fix after
        record.unclippedEnd = pos + lseq; // fix after
        record.inferredInsertSize = tlen; // correct?
        record.attributes = {};

        var readName = '';
        for (var j = 0; j < nl-1; ++j) {
            readName += String.fromCharCode(ba[offset + 36 + j]);
        }
        record.name = readName;


        if (!opts.light) {
            if (nextRef >= 0) {
                record.mateSegment = nextRef; // this.indexToChr[nextRef];
                record.mateAlignmentStart = nextPos;
            }

            var p = offset + 36 + nl;

            var cigar = '';
            for (var c = 0; c < nc; ++c) {
                var cigop = readInt(ba, p);
                cigar = cigar + (cigop>>4) + record.CIGAR_DECODER[cigop & 0xf];
                p += 4;
            }
            record.cigar = cigar;

            // fix unclippedStart, unclippedEnd, blocks
            if (/\d+S/.test(cigar)) {
                var matched = cigar.match(/\d+\w/g),
                    clippedlen = 0;
                if (/S$/.test(matched[0])) {
                    var m2 = matched[0].match(/\d+/);
                    record.unclippedStart -= m2[0]|0;
                    clippedlen += m2[0]|0;
                }
                if (/S$/.test(matched[matched.length - 1])) {
                    var m2 = matched[matched.length - 1].match(/\d+/);
                    record.unclippedEnd += m2[0]|0;
                    clippedlen += m2[0]|0;
                }
                matched
                    .filter(function(x) { return /I$/.test(x); })
                    .forEach(function(x) {
                        var m2 = x.match(/\d+/);
                        clippedlen += m2[0]|0;
                    });
                record.blocks = lseq - clippedlen;
                // console.log(matched, "clipped", clippedlen);
            }

            var seq = '';
            var seqBytes = (lseq + 1) >> 1;
            for (var j = 0; j < seqBytes; ++j) {
                var sb = ba[p + j];
                seq += record.SEQRET_DECODER[(sb & 0xf0) >> 4];
                if (seq.length < lseq)
                    seq += record.SEQRET_DECODER[(sb & 0x0f)];
            }
            p += seqBytes;
            record.read = seq;

            var qseq = '';
            for (var j = 0; j < lseq; ++j) {
                qseq += String.fromCharCode(ba[p + j] + 33);
            }
            p += lseq;
            record.baseQualityString = qseq;

            while (p < blockEnd) {
                var tag = String.fromCharCode(ba[p], ba[p + 1]);
                var type = String.fromCharCode(ba[p + 2]);
                var value;

                if (type == 'A') {
                    value = String.fromCharCode(ba[p + 3]);
                    p += 4;
                } else if (type == 'i' || type == 'I') {
                    value = readInt(ba, p + 3);
                    p += 7;
                } else if (type == 'c' || type == 'C') {
                    value = ba[p + 3];
                    p += 4;
                } else if (type == 's' || type == 'S') {
                    value = readShort(ba, p + 3);
                    p += 5;
                } else if (type == 'f') {
                    value = readFloat(ba, p + 3);
                    p += 7;
                } else if (type == 'Z' || type == 'H') {
                    p += 3;
                    value = '';
                    for (;;) {
                        var cc = ba[p++];
                        if (cc == 0) {
                            break;
                        } else {
                            value += String.fromCharCode(cc);
                        }
                    }
                } else if (type == 'B') {
                    var atype = String.fromCharCode(ba[p + 3]);
                    var alen = readInt(ba, p + 4);
                    var elen;
                    var reader;
                    if (atype == 'i' || atype == 'I' || atype == 'f') {
                        elen = 4;
                        if (atype == 'f')
                            reader = readFloat;
                        else
                            reader = readInt;
                    } else if (atype == 's' || atype == 'S') {
                        elen = 2;
                        reader = readShort;
                    } else if (atype == 'c' || atype == 'C') {
                        elen = 1;
                        reader = readByte;
                    } else {
                        throw 'Unknown array type ' + atype;
                    }

                    p += 8;
                    value = [];
                    for (var i = 0; i < alen; ++i) {
                        value.push(reader(ba, p));
                        p += elen;
                    }
                } else {
                    throw 'Unknown type '+ type;
                }
                record.attributes[tag] = value;
            }
        }

        if (_.isFunction(opts.segment2chrom)) {
            opts.segment2chrom([record]);
        }

        if (!min || record.start <= max && record.start + lseq >= min) {
            if (chrId == undefined || refID == chrId) {
                sink.push(record);
            }
        }
        if (record.start > max) {
            return true;
        }
        offset = blockEnd;
    }

    // Exits via top of loop.
};

// ======================
